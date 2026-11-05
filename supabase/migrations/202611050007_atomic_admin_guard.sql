-- Phase 0 security: last-administrator protection must be atomic across concurrent RPCs.
-- This is a database-level fail-safe in addition to the existing admin RPC checks.
BEGIN;

CREATE OR REPLACE FUNCTION private.ensure_last_club_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE v_admins integer;
BEGIN
  IF OLD.role <> 'admin' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.role = 'admin' THEN RETURN NEW; END IF;

  -- Serialize role reductions per club. Without this lock, simultaneous admin
  -- demotions could both observe two admins and leave the club unmanaged.
  PERFORM 1 FROM public.clubs WHERE id = OLD.club_id FOR UPDATE;
  IF NOT FOUND THEN
    -- A deleted parent club is being cascaded; there is no surviving club to protect.
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Club non atopado';
  END IF;

  SELECT count(*) INTO v_admins
  FROM public.club_memberships
  WHERE club_id = OLD.club_id AND role = 'admin';

  IF v_admins <= 1 THEN
    RAISE EXCEPTION 'Non se pode retirar a última conta administradora';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.ensure_last_club_admin()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_last_club_admin ON public.club_memberships;
CREATE TRIGGER guard_last_club_admin
BEFORE UPDATE OF role OR DELETE ON public.club_memberships
FOR EACH ROW EXECUTE FUNCTION private.ensure_last_club_admin();

COMMIT;
