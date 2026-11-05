-- Phase 2 launch gate integration test. Always ends in ROLLBACK.
BEGIN;
SET LOCAL statement_timeout='45s';
CREATE TEMP TABLE _phase2_ids (
  season_id uuid NOT NULL, admin_id uuid NOT NULL, participant_id uuid NOT NULL
);
INSERT INTO _phase2_ids
SELECT s.id,
 (SELECT m.user_id FROM public.club_memberships m
   WHERE m.club_id=s.club_id AND m.role='admin' ORDER BY m.joined_at LIMIT 1),
 (SELECT m.user_id FROM public.club_memberships m
   WHERE m.club_id=s.club_id AND m.role='participant' ORDER BY m.joined_at LIMIT 1)
FROM public.seasons s ORDER BY s.created_at DESC LIMIT 1;
DO $$
BEGIN
 IF (SELECT count(*) FROM _phase2_ids WHERE admin_id IS NOT NULL
   AND participant_id IS NOT NULL)<>1
 THEN RAISE EXCEPTION 'Requires an admin and a participant'; END IF;
END $$;

GRANT SELECT ON _phase2_ids TO authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT admin_id::text FROM _phase2_ids),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_season uuid:=(SELECT season_id FROM _phase2_ids);
       v_key text;v_status jsonb;v_blocked boolean:=false;
BEGIN
 v_status:=public.fantasy_launch_status(v_season);
 IF v_status->>'ready' <> 'false' THEN
   RAISE EXCEPTION 'Expected launch to start blocked'; END IF;

 BEGIN
   PERFORM public.fantasy_activate_season(v_season);
 EXCEPTION WHEN others THEN
   IF position('Lanzamento bloqueado' in sqlerrm)>0
   THEN v_blocked:=true; ELSE RAISE; END IF;
 END;
 IF NOT v_blocked THEN RAISE EXCEPTION 'Launch without sign-off was allowed'; END IF;

 FOREACH v_key IN ARRAY ARRAY[
   'backup_restore','minor_privacy','browser_e2e','email_invites','security_review'
 ] LOOP
   PERFORM public.fantasy_set_launch_check(v_season,v_key,true,
     'Proba reversible: non equivale a unha verificación documental real');
 END LOOP;

 v_status:=public.fantasy_launch_status(v_season);
 IF v_status->>'ready'<>'true' OR (v_status->>'completed_count')::integer<>5
 THEN RAISE EXCEPTION 'Sign-off was not counted'; END IF;

 PERFORM public.fantasy_activate_season(v_season);
 IF NOT (SELECT active FROM public.seasons WHERE id=v_season)
 THEN RAISE EXCEPTION 'Activation was not applied inside test transaction'; END IF;

 v_blocked:=false;
 BEGIN
   PERFORM public.fantasy_set_launch_check(v_season,'security_review',false,
     'Proba reversible de revogación despois de activar');
 EXCEPTION WHEN others THEN
   IF position('despois do lanzamento' in sqlerrm)>0
   THEN v_blocked:=true; ELSE RAISE; END IF;
 END;
 IF NOT v_blocked THEN RAISE EXCEPTION 'Sign-off can be silently revoked after launch'; END IF;
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub',(SELECT participant_id::text FROM _phase2_ids),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_season uuid:=(SELECT season_id FROM _phase2_ids);
       v_denied boolean:=false;
BEGIN
 BEGIN PERFORM public.fantasy_launch_status(v_season);
 EXCEPTION WHEN others THEN
   IF position('Só administración' in sqlerrm)>0
   THEN v_denied:=true; ELSE RAISE; END IF;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Participant could read private launch checks'; END IF;

 v_denied:=false;
 BEGIN
   PERFORM public.fantasy_set_launch_check(v_season,'backup_restore',true,
     'Proba de permisos negados á conta participante');
 EXCEPTION WHEN others THEN
   IF position('Só administración' in sqlerrm)>0
   THEN v_denied:=true; ELSE RAISE; END IF;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Participant could attest launch readiness'; END IF;
END $$;
ROLLBACK;
