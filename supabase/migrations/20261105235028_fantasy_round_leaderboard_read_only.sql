-- Historical league table, accessible only to invited club members.
-- All scores are read from finalized fixtures, never current rosters or admin drafts.
CREATE OR REPLACE FUNCTION public.fantasy_round_leaderboard(p_season uuid)
RETURNS TABLE(round_number smallint, "position" bigint, team_id uuid, team_name text, manager_alias text, round_points numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_club uuid;
BEGIN
 SELECT s.club_id INTO v_club FROM public.seasons s WHERE s.id=p_season;
 IF v_club IS NULL OR auth.uid() IS NULL OR private.is_member(v_club) IS DISTINCT FROM TRUE THEN
   RAISE EXCEPTION 'Só membros do club';
 END IF;
 RETURN QUERY
 SELECT ranked.rnd, ranked.ranking_position, ranked.id, ranked.name,
        ranked.alias, ranked.points
 FROM (
  SELECT f.round_number AS rnd,
    row_number() OVER (PARTITION BY f.round_number ORDER BY rs.fantasy_points DESC,t.created_at ASC,t.id ASC) AS ranking_position,
    t.id, t.name,coalesce(pr.display_name,'Participante') AS alias,
    round(rs.fantasy_points,2) AS points
  FROM public.team_round_scores rs
  JOIN public.fixtures f ON f.id=rs.fixture_id AND f.season_id=p_season AND f.status='finalized'
  JOIN public.fantasy_teams t ON t.id=rs.team_id AND t.season_id=p_season
  LEFT JOIN public.profiles pr ON pr.id=t.user_id
 ) ranked
 ORDER BY ranked.rnd DESC,ranked.ranking_position ASC;
END; $function$;
REVOKE ALL ON FUNCTION public.fantasy_round_leaderboard(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fantasy_round_leaderboard(uuid) TO authenticated;
