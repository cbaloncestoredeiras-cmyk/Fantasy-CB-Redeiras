-- Migration 004 - match statistics, teammate voting and price/score publication
-- Requires migrations 001-003. Server authorisation and an audit trail throughout.
begin;

create or replace function public.fantasy_set_callups(p_fixture uuid,p_players uuid[])
returns integer language plpgsql security definer set search_path=''
as $$
declare f public.fixtures%rowtype; v_club uuid; v_count integer;
begin
 select * into f from public.fixtures where id=p_fixture for update;
 if not found then raise exception 'Partido non atopado'; end if;
 select club_id into v_club from public.seasons where id=f.season_id;
 if not private.is_admin(v_club) then raise exception 'Só administración'; end if;
 if f.status='finalized' or exists(select 1 from public.locker_votes where fixture_id=p_fixture) then
   raise exception 'Convocatoria bloqueada: xa hai votos ou datos publicados'; end if;
 if p_players is null or cardinality(p_players)<3 or cardinality(p_players)>18 or
   (select count(distinct x) from unnest(p_players) u(x))<>cardinality(p_players) then
   raise exception 'Convocatoria incorrecta'; end if;
 select count(*) into v_count from public.players
 where id=any(p_players) and club_id=v_club and active;
 if v_count<>cardinality(p_players) then raise exception 'Hai xogadores que non son deste club'; end if;
 delete from public.eligible_voters where fixture_id=p_fixture;
 delete from public.fixture_callups where fixture_id=p_fixture;
 insert into public.fixture_callups(fixture_id,player_id)
 select p_fixture,x from unnest(p_players) u(x);
 insert into public.eligible_voters(fixture_id,user_id)
 select p_fixture,a.user_id from public.player_accounts a where a.player_id=any(p_players);
 insert into public.fantasy_audit(club_id,actor_id,event_type,details)
 values(v_club,auth.uid(),'set_callups',jsonb_build_object('fixture',p_fixture,'count',v_count));
 return v_count;
end; $$;

create or replace function public.fantasy_vote(p_fixture uuid,p_first uuid,p_second uuid,p_third uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare f public.fixtures%rowtype; v_self uuid; v_club uuid; v_count int;
begin
 if auth.uid() is null then raise exception 'Inicia sesión para votar'; end if;
 select * into f from public.fixtures where id=p_fixture for share;
 if not found or f.ended_at is null or now()<f.ended_at or now()>=f.ended_at+interval '72 hours'
 then raise exception 'Fóra das 72 horas de votación'; end if;
 select club_id into v_club from public.seasons where id=f.season_id;
 if not private.is_member(v_club) then raise exception 'Acceso non autorizado'; end if;
 if not exists(select 1 from public.eligible_voters
   where fixture_id=p_fixture and user_id=auth.uid()) then
   raise exception 'Só votan os xogadores convocados'; end if;
 select player_id into v_self from public.player_accounts where user_id=auth.uid();
 if v_self is null then raise exception 'Conta non asociada a un xogador'; end if;
 if p_first is null or p_second is null or p_third is null
   or p_first=p_second or p_first=p_third or p_second=p_third
   or v_self=any(array[p_first,p_second,p_third]) then raise exception 'Voto inválido'; end if;
 select count(*) into v_count from public.fixture_callups
 where fixture_id=p_fixture and player_id=any(array[p_first,p_second,p_third]);
 if v_count<>3 then raise exception 'Só se pode votar a tres compañeiros convocados'; end if;
 -- Delete then insert atomically: allows reordering earlier selections without a uniqueness race.
 delete from public.locker_votes where fixture_id=p_fixture and voter_user_id=auth.uid();
 insert into public.locker_votes(fixture_id,voter_user_id,recipient_player_id,points)
 values(p_fixture,auth.uid(),p_first,3),(p_fixture,auth.uid(),p_second,2),(p_fixture,auth.uid(),p_third,1);
 insert into public.fantasy_audit(club_id,actor_id,event_type,details)
 values(v_club,auth.uid(),'cast_ballot',jsonb_build_object('fixture',p_fixture));
end; $$;

create or replace function public.fantasy_save_stats(p_fixture uuid,p_rows jsonb)
returns integer language plpgsql security definer set search_path=''
as $$
declare f public.fixtures%rowtype; v_club uuid; v_count int; row jsonb; v_pid uuid;
  v_pir numeric; v_minutes numeric; v_played boolean;
begin
 select * into f from public.fixtures where id=p_fixture for update;
 if not found then raise exception 'Partido non atopado'; end if;
 select club_id into v_club from public.seasons where id=f.season_id;
 if not private.is_admin(v_club) then raise exception 'Só administración'; end if;
 if f.ended_at is null or f.status='finalized' then
  raise exception 'Indica primeiro a hora de final e non alteres xornadas publicadas'; end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)<1 or jsonb_array_length(p_rows)>40
 then raise exception 'Importación incorrecta'; end if;
 v_count:=0;
 for row in select value from jsonb_array_elements(p_rows)
 loop
  v_pid:=(row->>'player_id')::uuid;
  if not exists(select 1 from public.players where id=v_pid and club_id=v_club)
  then raise exception 'O rexistro contén un xogador doutro club ou inexistente'; end if;
  v_played:=coalesce((row->>'played')::boolean,false);
  v_minutes:=coalesce((row->>'minutes')::numeric,0);
  v_pir:=(row->>'pir')::numeric;
  if v_minutes<0 or v_minutes>60 or v_pir is null or v_pir not between -100 and 100
   then raise exception 'Minutos/PIR incorrectos; revisa a importación'; end if;
  if v_played=false and (v_minutes>0 or v_pir<>0) then
    raise exception 'Xogador sen minutos cunha valoración non nula'; end if;
  insert into public.game_stats(fixture_id,player_id,minutes,points,rebounds,assists,
    steals,blocks,turnovers,pir,played,source_format)
  values(p_fixture,v_pid,v_minutes,coalesce((row->>'points')::int,0),
    coalesce((row->>'rebounds')::int,0),coalesce((row->>'assists')::int,0),
    coalesce((row->>'steals')::int,0),coalesce((row->>'blocks')::int,0),
    coalesce((row->>'turnovers')::int,0),v_pir,v_played,
    coalesce(nullif(row->>'source_format',''),'manual'))
  on conflict(fixture_id,player_id) do update set
    minutes=excluded.minutes,points=excluded.points,rebounds=excluded.rebounds,
    assists=excluded.assists,steals=excluded.steals,blocks=excluded.blocks,
    turnovers=excluded.turnovers,pir=excluded.pir,played=excluded.played,
    source_format=excluded.source_format,revised_at=now();
  v_count:=v_count+1;
 end loop;
 update public.fixtures set stats_finalized_at=now(),status='awaiting_votes' where id=p_fixture;
 insert into public.fantasy_audit(club_id,actor_id,event_type,details)
 values(v_club,auth.uid(),'import_stats',jsonb_build_object('fixture',p_fixture,'rows',v_count));
 return v_count;
end; $$;

-- 3% price movement per fantasy point above/below price-implied expectation;
-- maximum +/-15% of previous price; 450k floor. Played=false --> unchanged.
create or replace function private.next_price(p_current integer,p_score numeric,p_played boolean)
returns integer language sql immutable set search_path=''
as $$
 select case when not p_played then p_current else
 greatest(450000,
   least(floor(p_current*1.15)::int,
    greatest(ceil(p_current*0.85)::int,
      round(
        greatest(450000,
          p_current*(1+greatest(-0.15,least(0.15,0.03*(p_score-greatest(0,(p_current-650000.0)/120000.0)))))
        )/5000.0)::int*5000
    )
   )
 ) end;
$$;

create or replace function public.fantasy_publish_fixture(p_fixture uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare f public.fixtures%rowtype; s public.seasons%rowtype; p record;
 v_votes numeric; v_eligible integer; v_bonus numeric; v_points numeric; v_price int;
 v_updated int:=0; v_teams int:=0;
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
  v_price:=private.next_price(p.price,v_points,coalesce(p.played,false));
  insert into public.price_history(season_id,player_id,round_number,price_before,price_after,change_reason)
  values(f.season_id,p.player_id,f.round_number,p.price,v_price,'broker_formula_v1')
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

-- Rankings show ONLY chosen team/alias, never email addresses.
create or replace function public.fantasy_leaderboard(p_season uuid)
returns table("position" bigint,team_id uuid,team_name text,manager_alias text,total_points numeric)
language plpgsql stable security definer set search_path=''
as $$
declare v_club uuid;
begin
 select club_id into v_club from public.seasons where id=p_season;
 if not private.is_member(v_club) then raise exception 'Só membros do club'; end if;
 return query
 select row_number() over(order by coalesce(sum(rs.fantasy_points),0) desc,t.created_at asc) as position,
 t.id,t.name,coalesce(pr.display_name,'Participante') as manager_alias,
 round(coalesce(sum(rs.fantasy_points),0),2) as total_points
 from public.fantasy_teams t left join public.profiles pr on pr.id=t.user_id
 left join public.team_round_scores rs on rs.team_id=t.id
 where t.season_id=p_season
 group by t.id,t.name,t.created_at,pr.display_name
 order by total_points desc,t.created_at asc;
end; $$;

create or replace function public.fantasy_set_alias(p_alias text)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or char_length(trim(coalesce(p_alias,''))) not between 2 and 40
 then raise exception 'Alias incorrecto'; end if;
 insert into public.profiles(id,display_name) values(auth.uid(),trim(p_alias))
 on conflict(id) do update set display_name=excluded.display_name;
end; $$;

revoke all on function private.next_price(integer,numeric,boolean) from public,anon;
revoke all on function public.fantasy_set_callups(uuid,uuid[]),public.fantasy_vote(uuid,uuid,uuid,uuid),
 public.fantasy_save_stats(uuid,jsonb),public.fantasy_publish_fixture(uuid),
 public.fantasy_leaderboard(uuid),public.fantasy_set_alias(text) from public,anon;
grant execute on function public.fantasy_set_callups(uuid,uuid[]),public.fantasy_vote(uuid,uuid,uuid,uuid),
 public.fantasy_save_stats(uuid,jsonb),public.fantasy_publish_fixture(uuid),
 public.fantasy_leaderboard(uuid),public.fantasy_set_alias(text) to authenticated;

commit;
