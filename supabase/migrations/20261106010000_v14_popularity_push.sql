-- V1.4: server-only aggregate popularity and opt-in Web Push infrastructure.
-- The subscription endpoint and encryption keys are private; no personal
-- roster can be inferred from published popularity metrics.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_endpoint_valid CHECK (length(endpoint) BETWEEN 30 AND 2048 AND endpoint ~ '^https://[^[:space:]]+$'),
  CONSTRAINT push_keys_valid CHECK (length(p256dh) BETWEEN 30 AND 300 AND length(auth_key) BETWEEN 8 AND 150),
  CONSTRAINT push_user_endpoint_unique UNIQUE (user_id,endpoint)
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_subscriptions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.push_subscriptions TO authenticated;
DROP POLICY IF EXISTS push_subscription_owner_read ON public.push_subscriptions;
CREATE POLICY push_subscription_owner_read ON public.push_subscriptions FOR SELECT TO authenticated
  USING (user_id=(select auth.uid()));
-- Only RPCs can add/remove a subscription. Do not grant direct INSERT/UPDATE.
CREATE OR REPLACE FUNCTION public.fantasy_push_register(p_endpoint text,p_p256dh text,p_auth text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $func$
DECLARE v_user uuid:=auth.uid(); v_id uuid;
BEGIN
 IF v_user IS NULL OR NOT EXISTS (SELECT 1 FROM public.club_memberships cm WHERE cm.user_id=v_user) THEN
  RAISE EXCEPTION 'Precisas unha conta invitada do club';
 END IF;
 IF p_endpoint IS NULL OR length(p_endpoint) NOT BETWEEN 30 AND 2048
    OR p_endpoint !~ '^https://[^[:space:]]+$'
    OR length(coalesce(p_p256dh,'')) NOT BETWEEN 30 AND 300
    OR length(coalesce(p_auth,'')) NOT BETWEEN 8 AND 150 THEN
  RAISE EXCEPTION 'Subscrición push non válida';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id=v_user AND endpoint=p_endpoint)
   AND (SELECT count(*) FROM public.push_subscriptions WHERE user_id=v_user)>=5 THEN
  RAISE EXCEPTION 'Máximo de cinco dispositivos por persoa';
 END IF;
 INSERT INTO public.push_subscriptions(user_id,endpoint,p256dh,auth_key,enabled,updated_at)
 VALUES (v_user,p_endpoint,p_p256dh,p_auth,true,now())
 ON CONFLICT(user_id,endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth_key=excluded.auth_key,
 enabled=true,updated_at=now()
 RETURNING id INTO v_id;
 RETURN v_id;
END; $func$;
CREATE OR REPLACE FUNCTION public.fantasy_push_unsubscribe(p_endpoint text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $func$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Require sesión'; END IF;
 DELETE FROM public.push_subscriptions WHERE user_id=auth.uid() AND endpoint=p_endpoint;
 RETURN FOUND;
END; $func$;
REVOKE ALL ON FUNCTION public.fantasy_push_register(text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fantasy_push_unsubscribe(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fantasy_push_register(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fantasy_push_unsubscribe(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fantasy_player_popularity(p_season uuid)
RETURNS TABLE(player_id uuid,pick_count bigint,total_teams bigint,pick_percent numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $func$
DECLARE v_club uuid; v_fixture uuid; v_total bigint;
BEGIN
 SELECT club_id INTO v_club FROM public.seasons WHERE id=p_season AND active;
 IF v_club IS NULL OR auth.uid() IS NULL OR private.is_member(v_club) IS DISTINCT FROM TRUE THEN
  RAISE EXCEPTION 'Só membros do club e tempadas activas';
 END IF;
 SELECT f.id INTO v_fixture FROM public.fixtures f
 WHERE f.season_id=p_season AND f.status='finalized' ORDER BY f.round_number DESC LIMIT 1;
 IF v_fixture IS NULL THEN RETURN; END IF;
 SELECT count(DISTINCT l.team_id) INTO v_total
 FROM public.fixture_lineups l JOIN public.fantasy_teams t ON t.id=l.team_id
 WHERE l.fixture_id=v_fixture AND t.season_id=p_season;
 IF v_total<5 THEN RETURN; END IF;
 RETURN QUERY
 SELECT mp.player_id,
  CASE WHEN count(l.team_id)>=3 THEN count(l.team_id) ELSE NULL::bigint END,
  v_total,
  CASE WHEN count(l.team_id)>=3 THEN round(100.0*count(l.team_id)/v_total,1) ELSE NULL::numeric END
 FROM public.market_prices mp
 LEFT JOIN public.fixture_lineups l ON l.fixture_id=v_fixture AND l.player_id=mp.player_id
 WHERE mp.season_id=p_season GROUP BY mp.player_id ORDER BY count(l.team_id) DESC, mp.player_id;
END; $func$;
REVOKE ALL ON FUNCTION public.fantasy_player_popularity(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fantasy_player_popularity(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS private.push_dispatches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 fixture_id uuid NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
 subscription_id uuid NOT NULL REFERENCES public.push_subscriptions(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','failed','sent')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 last_attempt_at timestamptz,
 sent_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(fixture_id,subscription_id)
);
CREATE INDEX IF NOT EXISTS push_dispatches_status_idx ON private.push_dispatches(status,last_attempt_at);
REVOKE ALL ON private.push_dispatches FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.fantasy_push_claim(p_limit integer DEFAULT 30)
RETURNS TABLE(dispatch_id uuid,endpoint text,p256dh text,auth_key text,round_number smallint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $func$
BEGIN
 -- EXECUTE granted solely to service_role. No user token may call this RPC.
 INSERT INTO private.push_dispatches(fixture_id,subscription_id)
 SELECT f.id,ps.id
 FROM public.fixtures f
 JOIN public.seasons s ON s.id=f.season_id AND s.active
 JOIN public.club_memberships cm ON cm.club_id=s.club_id
 JOIN public.push_subscriptions ps ON ps.user_id=cm.user_id AND ps.enabled
 WHERE f.status='scheduled' AND f.starts_at>now()
   AND f.starts_at<=now()+interval '60 minutes'
 ON CONFLICT DO NOTHING;
 RETURN QUERY
 WITH picked AS (
  SELECT d.id FROM private.push_dispatches d
  JOIN public.fixtures f ON f.id=d.fixture_id
  JOIN public.push_subscriptions ps ON ps.id=d.subscription_id
  WHERE f.status='scheduled' AND f.starts_at>now() AND ps.enabled
    AND d.attempts<3
    AND (d.status IN ('pending','failed') OR
      (d.status='processing' AND d.last_attempt_at<now()-interval '10 minutes'))
    AND (d.last_attempt_at IS NULL OR d.last_attempt_at<=now()-interval '5 minutes')
  ORDER BY f.starts_at,d.created_at
  LIMIT LEAST(GREATEST(coalesce(p_limit,30),1),100)
  FOR UPDATE OF d SKIP LOCKED
 ), claimed AS (
  UPDATE private.push_dispatches d SET status='processing',attempts=d.attempts+1,last_attempt_at=now()
  WHERE d.id IN (SELECT id FROM picked)
  RETURNING d.id,d.fixture_id,d.subscription_id
 )
 SELECT claimed.id,ps.endpoint,ps.p256dh,ps.auth_key,f.round_number
 FROM claimed JOIN public.push_subscriptions ps ON ps.id=claimed.subscription_id
 JOIN public.fixtures f ON f.id=claimed.fixture_id;
END; $func$;
CREATE OR REPLACE FUNCTION public.fantasy_push_complete(p_dispatch uuid,p_success boolean,p_invalid boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $func$
DECLARE v_sub uuid;
BEGIN
 UPDATE private.push_dispatches SET status=CASE WHEN p_success THEN 'sent' ELSE 'failed' END,
 sent_at=CASE WHEN p_success THEN now() ELSE NULL END
 WHERE id=p_dispatch AND status='processing' RETURNING subscription_id INTO v_sub;
 IF v_sub IS NULL THEN RETURN false; END IF;
 IF p_invalid THEN UPDATE public.push_subscriptions SET enabled=false WHERE id=v_sub; END IF;
 RETURN true;
END; $func$;
REVOKE ALL ON FUNCTION public.fantasy_push_claim(integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fantasy_push_complete(uuid,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fantasy_push_claim(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.fantasy_push_complete(uuid,boolean,boolean) TO service_role;
