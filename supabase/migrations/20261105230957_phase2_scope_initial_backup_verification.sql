-- Applied to production as migration 20261105230957.
-- First-round scope: the SQL database was restored locally and checked,
-- and the club keeps original player photographs for manual replacement.
-- This does NOT certify a binary Storage restore. Five independent launch
-- checks, administrator authorization and all activation gates are preserved.
DO $migration$
DECLARE v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.fantasy_launch_status(uuid)'::regprocedure)
  INTO v_definition;
  IF position('Copia íntegra restaurada e comprobada' in v_definition)=0 THEN
    RAISE EXCEPTION 'Expected launch label not found; no changes applied';
  END IF;
  EXECUTE replace(v_definition,
    'Copia íntegra restaurada e comprobada',
    'Base de datos restaurada; fotos orixinais conservadas polo club');
END
$migration$;
