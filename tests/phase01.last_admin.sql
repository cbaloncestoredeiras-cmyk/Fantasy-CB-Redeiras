-- Run ONLY in a controlled environment or a session you can guarantee will ROLLBACK.
-- This test temporarily demotes an admin within the same uncommitted transaction.
-- It must never be run by a CI job against production without isolation.
BEGIN;
SET LOCAL statement_timeout = '12s';

DO $$
DECLARE v_club uuid; v_admin_1 uuid; v_admin_2 uuid; v_denied boolean := false;
BEGIN
  SELECT club_id INTO v_club FROM public.club_memberships
  GROUP BY club_id HAVING count(*) FILTER (WHERE role = 'admin') >= 1 LIMIT 1;
  IF v_club IS NULL THEN RAISE EXCEPTION 'No admin account to test'; END IF;

  SELECT user_id INTO v_admin_1
  FROM public.club_memberships
  WHERE club_id = v_club AND role='admin' ORDER BY joined_at LIMIT 1;

  SELECT user_id INTO v_admin_2
  FROM public.club_memberships
  WHERE club_id = v_club AND role='admin' AND user_id<>v_admin_1
  ORDER BY joined_at LIMIT 1;

  IF v_admin_2 IS NOT NULL THEN
    UPDATE public.club_memberships SET role='participant'
      WHERE club_id=v_club AND user_id=v_admin_1;
    BEGIN
      UPDATE public.club_memberships SET role='participant'
      WHERE club_id=v_club AND user_id=v_admin_2;
    EXCEPTION WHEN OTHERS THEN
      IF position('última conta administradora' IN SQLERRM)>0 THEN
        v_denied := true;
      ELSE RAISE;
      END IF;
    END;
  ELSE
    BEGIN
      UPDATE public.club_memberships SET role='participant'
      WHERE club_id=v_club AND user_id=v_admin_1;
    EXCEPTION WHEN OTHERS THEN
      IF position('última conta administradora' IN SQLERRM)>0 THEN
        v_denied := true;
      ELSE RAISE;
      END IF;
    END;
  END IF;

  IF NOT v_denied THEN RAISE EXCEPTION 'The last admin was demoted'; END IF;
  IF (SELECT count(*) FROM public.club_memberships
      WHERE club_id=v_club AND role='admin')<>1 THEN
    RAISE EXCEPTION 'Unexpected number of admins after simulated demotion';
  END IF;
END;
$$;
ROLLBACK;
