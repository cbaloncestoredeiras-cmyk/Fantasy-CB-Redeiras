-- Migration 007 - PostgreSQL API grants + prevent early stats exposure
begin;
-- PostgREST privileges must be explicit; authenticated requests still have RLS.
grant usage on schema public to authenticated;
grant select on public.clubs,public.profiles,public.club_memberships,
 public.seasons,public.players,public.player_positions,public.fixtures,
 public.market_prices,public.price_history,public.fantasy_teams,
 public.team_rosters,public.transfers,public.game_stats,public.player_accounts,
 public.eligible_voters,public.locker_votes,public.team_round_scores,
 public.fixture_lineups,public.fixture_callups,public.fantasy_audit to authenticated;

revoke insert,update,delete on public.clubs,public.profiles,public.club_memberships,
 public.seasons,public.players,public.player_positions,public.fixtures,
 public.market_prices,public.price_history,public.fantasy_teams,
 public.team_rosters,public.transfers,public.game_stats,public.player_accounts,
 public.eligible_voters,public.locker_votes,public.team_round_scores,
 public.fixture_lineups,public.fixture_callups,public.fantasy_audit
 from authenticated,anon;

-- Never expose boxscores imported before the 72h player voting period closes.
drop policy if exists stats_members_read on public.game_stats;
create policy stats_after_publication_or_admin on public.game_stats
for select to authenticated using (
 exists (
  select 1 from public.fixtures f join public.seasons s on s.id=f.season_id
  where f.id=fixture_id and private.is_member(s.club_id)
    and (f.status='finalized' or private.is_admin(s.club_id))
 )
);

-- Only a manager themselves (and audited server RPCs) can view transfer transactions.
-- Keep cross-user data aggregated in leaderboard RPC.
create or replace function public.fantasy_admin_metrics(p_club uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_users int; v_teams int; v_juniors int; v_finished int; v_votes int;
begin
 if not private.is_admin(p_club) then raise exception 'Só administración'; end if;
 select count(*) into v_users from public.club_memberships where club_id=p_club;
 select count(*) into v_teams from public.fantasy_teams t join public.seasons s on s.id=t.season_id
 where s.club_id=p_club;
 select count(*) into v_juniors from public.players where club_id=p_club and category='junior' and active;
 select count(*) into v_finished from public.fixtures f join public.seasons s on s.id=f.season_id
 where s.club_id=p_club and f.status='finalized';
 select count(*)/3 into v_votes from public.locker_votes v join public.fixtures f on f.id=v.fixture_id
 join public.seasons s on s.id=f.season_id where s.club_id=p_club;
 return jsonb_build_object('members',v_users,'teams',v_teams,'juniors',v_juniors,'finalized_rounds',v_finished,'ballots',v_votes);
end; $$;
revoke all on function public.fantasy_admin_metrics(uuid) from public,anon;
grant execute on function public.fantasy_admin_metrics(uuid) to authenticated;
commit;
