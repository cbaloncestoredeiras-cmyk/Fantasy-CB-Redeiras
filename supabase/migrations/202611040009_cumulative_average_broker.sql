-- Migration 009 - accumulated-average broker. Reviewed for initial launch (no rounds finalized).
-- Requires 001..008. No existing price rows are recalculated; affects future publications only.
begin;

alter table public.price_history
  add column if not exists accumulated_average numeric(8,2),
  add column if not exists played_games integer check (played_games >= 0);

-- private.next_price keeps its existing signature for backwards compatibility; its second
-- argument now represents the accumulated AVERAGE, computed in fantasy_publish_fixture.
create or replace function private.next_price(p_current integer,p_score numeric,p_played boolean)
returns integer language sql immutable set search_path=''
as $$
  -- p_score is the cumulative average of *played* rounds' fantasy_points, not the last match score.
  -- Target in virtual euros = 450,000 + 100,000 * accumulated average.
  -- Price moves towards target, rounded to 5,000, bounded by +/-15% of the current price.
  -- No appearance means no change, even if the cumulative average exceeds the current price.
  select case when not p_played then p_current else
    greatest(450000,
      least(
        floor(p_current::numeric * 1.15 / 5000)::integer * 5000,
        greatest(
          ceil(p_current::numeric * 0.85 / 5000)::integer * 5000,
          round(greatest(450000::numeric, 450000::numeric + 100000::numeric * coalesce(p_score,0)) / 5000)::integer * 5000
        )
      )
    )
  end;
$$;

create or replace function public.fantasy_publish_fixture(p_fixture uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare f public.fixtures%rowtype; s public.seasons%rowtype; p record;
 v_votes numeric; v_eligible integer; v_bonus numeric; v_points numeric; v_price int;
 v_updated int:=0; v_teams int:=0; v_average numeric; v_games integer;
begin
 select * into f from public.fixtures where id=p_fixture for update;
 if not found then raise exception 'Partido non atopado'; end if;
 select * into s from public.seasons where id=f.season_id;
 if not private.is_admin(s.club_id) then raise exception 'Só administración'; end if;
 if f.status='finalized' then raise exception 'A xornada xa está publicada'; end if;
 if f.ended_at is null or f.stats_finalized_at is null or f.team_won is null
   or now()<f.ended_at+interval '72 hours' then
   raise exception 'Agarda ao fin das votacións e a ter estatísticas completas'; end if;
 -- Freeze each team roster as it stood at the game's opening (edits were blocked at tip-off).
 insert into public.fixture_lineups(fixture_id,team_id,player_id)
 select p_fixture,t.id,r.player_id
 from public.fantasy_teams t join public.team_rosters r on r.team_id=t.id
 where t.season_id=f.season_id
 on conflict do nothing;
 select count(*) into v_eligible from public.fixture_callups where fixture_id=p_fixture;
 for p in select mp.player_id,mp.price,gs.played,gs.pir
   from public.market_prices mp
   left join public.game_stats gs on gs.player_id=mp.player_id and gs.fixture_id=p_fixture
   where mp.season_id=f.season_id
 loop
  select coalesce(sum(points),0) into v_votes
  from public.locker_votes where fixture_id=p_fixture and recipient_player_id=p.player_id;
  -- Normalise by total called-up players, even if someone abstained/has no login.
  v_bonus:=case when coalesce(p.played,false) and v_eligible>0 then round(v_votes/v_eligible,2) else 0 end;
  v_points:=case when coalesce(p.played,false)
    then round(coalesce(p.pir,0)*case when f.team_won and p.pir>0 then 1.20 else 1 end+v_bonus,2)
    else 0 end;
  if exists(select 1 from public.game_stats where fixture_id=p_fixture and player_id=p.player_id)
  then update public.game_stats set fantasy_points=v_points,vote_bonus=v_bonus
    where fixture_id=p_fixture and player_id=p.player_id; end if;
  -- Include this fixture's freshly calculated points and only older finalized fixtures.
  -- A missed game is ignored in the average and never changes the market price.
  select avg(st.fantasy_points), count(*) into v_average, v_games
  from public.game_stats st
  join public.fixtures prev on prev.id=st.fixture_id
  where st.player_id=p.player_id and prev.season_id=f.season_id
    and prev.round_number<=f.round_number
    and st.played is true and st.fantasy_points is not null
    and (prev.status='finalized' or prev.id=p_fixture);
  v_price:=private.next_price(p.price,v_average,coalesce(p.played,false));
  insert into public.price_history(season_id,player_id,round_number,price_before,price_after,change_reason,accumulated_average,played_games)
  values(f.season_id,p.player_id,f.round_number,p.price,v_price,'broker_cumulative_average_v2',
         case when v_games>0 then round(v_average,2) else null end,v_games)
  on conflict(season_id,player_id,round_number) do nothing;
  update public.market_prices set price=v_price,updated_at=now()
  where season_id=f.season_id and player_id=p.player_id;
  v_updated:=v_updated+1;
 end loop;
 insert into public.team_round_scores(team_id,fixture_id,fantasy_points)
 select t.id,p_fixture,coalesce(sum(gs.fantasy_points),0)
 from public.fantasy_teams t
 left join public.fixture_lineups l on l.team_id=t.id and l.fixture_id=p_fixture
 left join public.game_stats gs on gs.fixture_id=p_fixture and gs.player_id=l.player_id
 where t.season_id=f.season_id
 group by t.id
 on conflict(team_id,fixture_id) do nothing;
 get diagnostics v_teams=row_count;
 update public.fixtures set status='finalized',votes_finalized_at=now() where id=p_fixture;
 insert into public.fantasy_audit(club_id,actor_id,event_type,details)
 values(s.club_id,auth.uid(),'publish_round',
 jsonb_build_object('fixture',p_fixture,'players',v_updated,'teams',v_teams));
 return jsonb_build_object('players_updated',v_updated,'teams_scored',v_teams,'round',f.round_number);
end; $$;


revoke all on function private.next_price(integer,numeric,boolean) from public,anon;
revoke all on function public.fantasy_publish_fixture(uuid) from public,anon;
grant execute on function public.fantasy_publish_fixture(uuid) to authenticated;

commit;
