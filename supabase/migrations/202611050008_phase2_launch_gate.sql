-- Phase 2: auditable launch gate for the existing invitation-only season.
-- No existing check is marked done by migration. The season stays inactive.
BEGIN;

CREATE TABLE IF NOT EXISTS public.fantasy_launch_checks (
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  check_key text NOT NULL CHECK (check_key IN (
    'backup_restore', 'minor_privacy', 'browser_e2e', 'email_invites', 'security_review'
  )),
  verified_by uuid NOT NULL REFERENCES auth.users(id),
  verified_at timestamptz NOT NULL DEFAULT now(),
  evidence_note text NOT NULL CHECK (char_length(trim(evidence_note)) BETWEEN 12 AND 1000),
  PRIMARY KEY (season_id, check_key)
);
ALTER TABLE public.fantasy_launch_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fantasy_launch_checks_admin_read ON public.fantasy_launch_checks;
CREATE POLICY fantasy_launch_checks_admin_read
ON public.fantasy_launch_checks FOR SELECT TO authenticated
USING (private.is_admin((SELECT club_id FROM public.seasons WHERE id=season_id)));
REVOKE ALL ON public.fantasy_launch_checks FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.fantasy_launch_checks TO authenticated;

-- Returns only administrative launch data, never public access.
CREATE OR REPLACE FUNCTION public.fantasy_launch_status(p_season uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_club uuid; v_checks jsonb; v_complete integer;
BEGIN
  SELECT club_id INTO v_club FROM public.seasons WHERE id=p_season;
  IF v_club IS NULL OR NOT private.is_admin(v_club) THEN
    RAISE EXCEPTION 'Só administración';
  END IF;

  WITH required(check_key,title,position) AS (
    VALUES
      ('backup_restore'::text,'Copia íntegra restaurada e comprobada'::text,1),
      ('minor_privacy','Privacidade e autorizacións documentadas',2),
      ('browser_e2e','Proba real no navegador con dúas contas',3),
      ('email_invites','Invitacións e recuperación de contrasinal verificadas',4),
      ('security_review','Seguridade e configuración de lanzamento revisadas',5)
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'key',r.check_key,'title',r.title,'verified',c.check_key IS NOT NULL,
    'verified_at',c.verified_at,'verified_by',c.verified_by,'note',c.evidence_note
  ) ORDER BY r.position),'[]'::jsonb)
  INTO v_checks
  FROM required r LEFT JOIN public.fantasy_launch_checks c
    ON c.season_id=p_season AND c.check_key=r.check_key;

  SELECT count(*) INTO v_complete
  FROM public.fantasy_launch_checks WHERE season_id=p_season;
  RETURN jsonb_build_object('season_id',p_season,'ready',v_complete=5,
    'completed_count',v_complete,'required_count',5,'checks',v_checks);
END;
$$;

CREATE OR REPLACE FUNCTION public.fantasy_set_launch_check(
  p_season uuid, p_key text, p_verified boolean, p_note text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_season public.seasons%rowtype; v_note text;
BEGIN
  SELECT * INTO v_season FROM public.seasons WHERE id=p_season FOR UPDATE;
  IF NOT FOUND OR NOT private.is_admin(v_season.club_id) THEN
    RAISE EXCEPTION 'Só administración';
  END IF;
  IF v_season.active THEN
    RAISE EXCEPTION 'Non se pode cambiar a verificación despois do lanzamento';
  END IF;
  IF p_key IS NULL OR p_key NOT IN (
      'backup_restore','minor_privacy','browser_e2e','email_invites','security_review'
    ) OR p_verified IS NULL THEN RAISE EXCEPTION 'Comprobación non válida'; END IF;

  v_note:=trim(coalesce(p_note,''));
  IF char_length(v_note) NOT BETWEEN 12 AND 1000 THEN
    RAISE EXCEPTION 'Describe a comprobación ou a revogación (12-1000 caracteres)';
  END IF;

  IF p_verified THEN
    INSERT INTO public.fantasy_launch_checks(season_id,check_key,verified_by,evidence_note)
    VALUES (p_season,p_key,auth.uid(),v_note)
    ON CONFLICT(season_id,check_key) DO UPDATE
    SET verified_by=excluded.verified_by,
        evidence_note=excluded.evidence_note,verified_at=now();
  ELSE
    DELETE FROM public.fantasy_launch_checks WHERE season_id=p_season AND check_key=p_key;
  END IF;
  INSERT INTO public.fantasy_audit(club_id,actor_id,event_type,details)
  VALUES(v_season.club_id,auth.uid(),'launch_check_update',
    jsonb_build_object('season',p_season,'key',p_key,'verified',p_verified,'note',v_note));
  RETURN public.fantasy_launch_status(p_season);
END;
$$;

CREATE OR REPLACE FUNCTION public.fantasy_activate_season(p_season uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE s public.seasons%rowtype; v_confirmed integer;
BEGIN
  SELECT * INTO s FROM public.seasons WHERE id=p_season FOR UPDATE;
  IF NOT FOUND OR NOT private.is_admin(s.club_id) THEN RAISE EXCEPTION 'Só administración'; END IF;
  IF s.active THEN RAISE EXCEPTION 'A tempada xa está activa'; END IF;

  SELECT count(*) INTO v_confirmed
  FROM public.fantasy_launch_checks WHERE season_id=p_season;
  IF v_confirmed <> 5 THEN
    RAISE EXCEPTION 'Lanzamento bloqueado: faltan % verificacións da fase 2',5-v_confirmed;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.fixtures
      WHERE season_id=p_season AND starts_at IS NOT NULL AND round_number>=s.start_round)
  THEN RAISE EXCEPTION 'Non hai calendario cun horario confirmado'; END IF;
  IF (SELECT count(*) FROM public.market_prices mp WHERE mp.season_id=p_season)<5
  THEN RAISE EXCEPTION 'O mercado aínda non ten xogadores abondo'; END IF;

  UPDATE public.seasons SET active=true WHERE id=p_season;
  INSERT INTO public.fantasy_audit(club_id,actor_id,event_type,details)
  VALUES(s.club_id,auth.uid(),'activate_season',
    jsonb_build_object('season',p_season,'readiness_verified',true));
END;
$$;

REVOKE ALL ON FUNCTION public.fantasy_launch_status(uuid),
  public.fantasy_set_launch_check(uuid,text,boolean,text),
  public.fantasy_activate_season(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fantasy_launch_status(uuid),
  public.fantasy_set_launch_check(uuid,text,boolean,text),
  public.fantasy_activate_season(uuid) TO authenticated;

COMMIT;
