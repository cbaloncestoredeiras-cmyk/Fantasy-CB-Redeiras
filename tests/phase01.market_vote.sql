-- Additional rollback-only test for invite-only market and vestuario vote lifecycle.
-- Run only on a controlled test database with at least one manager and linked player.
begin;
set local statement_timeout='45s';
create temp table _mx_user(manager_id uuid,voter_id uuid,voter_player uuid,season_id uuid,club_id uuid);
insert into _mx_user
select (select user_id from public.club_memberships where role='participant' order by joined_at limit 1),
       (select pa.user_id from public.player_accounts pa join public.club_memberships cm on cm.user_id=pa.user_id
          order by cm.joined_at limit 1),
       (select pa.player_id from public.player_accounts pa join public.club_memberships cm on cm.user_id=pa.user_id
          order by cm.joined_at limit 1),
       s.id,s.club_id from public.seasons s order by s.created_at desc limit 1;
create temp table _mx_players(seq int primary key,player_id uuid not null unique);
with season as (select * from _mx_user),
base as (select p.id from public.players p join public.player_positions pp on pp.player_id=p.id and pp.position='BA'
join public.market_prices mp on mp.player_id=p.id and mp.season_id=(select season_id from season)
where p.club_id=(select club_id from season) and p.active order by mp.price,p.id limit 1),
inside as (select p.id from public.players p join public.player_positions pp on pp.player_id=p.id and pp.position in ('AP','P')
join public.market_prices mp on mp.player_id=p.id and mp.season_id=(select season_id from season)
where p.club_id=(select club_id from season) and p.active and p.id<>(select id from base)
order by mp.price,p.id limit 1),
extra as (select p.id,row_number() over (order by mp.price,p.id) as rn from public.players p
join public.market_prices mp on mp.player_id=p.id and mp.season_id=(select season_id from season)
where p.club_id=(select club_id from season) and p.active
and p.id<>(select id from base) and p.id<>(select id from inside))
insert into _mx_players select 1,id from base union all select 2,id from inside union all
select 2+rn,id from extra where rn<=7;
do $$
begin
 if (select count(*) from _mx_players)<>9 then raise exception 'Test needs 9 distinct market players'; end if;
 if (select count(*) from _mx_user where manager_id is not null and voter_id is not null)<>1
 then raise exception 'Test needs manager and linked voter'; end if;
 if exists(select 1 from public.fantasy_teams where season_id=(select season_id from _mx_user)
  and user_id=(select manager_id from _mx_user)) then raise exception 'Test manager already has a team'; end if;
end $$;
update public.seasons set active=true where id=(select season_id from _mx_user);
update public.fixtures set starts_at=now()+interval '1 day',status='scheduled',ended_at=null
where season_id=(select season_id from _mx_user) and round_number=5;
create temp table _vote_fixture(id uuid);
with f as (
 insert into public.fixtures(season_id,round_number,opponent,starts_at,ended_at,status,team_won)
 select season_id,2,'__TEST_VOTE_TX__',now()-interval '5 days',now()-interval '1 day','awaiting_votes',true
 from _mx_user returning id)
insert into _vote_fixture select id from f;
insert into public.fixture_callups(fixture_id,player_id)
select (select id from _vote_fixture),x.player_id from (
select voter_player as player_id from _mx_user
union all
select p.id as player_id from public.players p
where p.club_id=(select club_id from _mx_user)
and p.id<>(select voter_player from _mx_user)
order by player_id limit 12) x;
insert into public.eligible_voters(fixture_id,user_id)
select (select id from _vote_fixture),voter_id from _mx_user;
grant select on _mx_user,_mx_players,_vote_fixture to authenticated;
select set_config('request.jwt.claim.sub',(select manager_id::text from _mx_user),true);
set local role authenticated;
do $$
declare ids uuid[];tid uuid;count_transfers int;step int;blocked boolean;
begin
 select array_agg(player_id order by seq) into ids from _mx_players where seq between 1 and 5;
 blocked:=false;
 begin
  perform public.fantasy_create_team((select season_id from _mx_user),'Cuatro xogadores',ids[1:4]);
 exception when others then blocked:=true;end;
 if not blocked then raise exception 'Invalid four-player lineup accepted'; end if;
 tid:=public.fantasy_create_team((select season_id from _mx_user),'Equipo de proba',ids);
 if tid is null then raise exception 'Team creation failed'; end if;
 for step in 6..8 loop
  select array_agg(player_id order by seq) into ids from _mx_players
  where seq in (1,2,4,5,step);
  perform public.fantasy_change_lineup(tid,ids);
 end loop;
 select count(*) into count_transfers from public.transfers where team_id=tid and round_number=5;
 if count_transfers<>3 then raise exception 'Expected three transfers, got %',count_transfers; end if;
 select array_agg(player_id order by seq) into ids from _mx_players where seq in (1,2,4,5,9);
 blocked:=false;
 begin
  perform public.fantasy_change_lineup(tid,ids);
 exception when others then
  if position('3 fichaxes' in sqlerrm)>0 then blocked:=true;else raise;end if;
 end;
 if not blocked then raise exception 'Fourth transfer incorrectly accepted'; end if;
end $$;
reset role;
update public.fixtures set starts_at=now()-interval '3 days'
where season_id=(select season_id from _mx_user) and round_number=5;
select set_config('request.jwt.claim.sub',(select manager_id::text from _mx_user),true);
set local role authenticated;
do $$
declare ids uuid[];tid uuid;blocked boolean:=false;
begin
 select array_agg(player_id order by seq) into ids from _mx_players where seq in (1,2,4,5,9);
 select id into tid from public.fantasy_teams where name='Equipo de proba';
 begin perform public.fantasy_change_lineup(tid,ids);
 exception when others then
  if position('Mercado pechado' in sqlerrm)>0 then blocked:=true;else raise;end if;
 end;
 if not blocked then raise exception 'Market did not close at kickoff'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select voter_id::text from _mx_user),true);
do $$
declare picks uuid[];self uuid;fid uuid;blocked boolean:=false;
begin
 self:=(select voter_player from _mx_user);
 fid:=(select id from _vote_fixture);
 select array_agg(player_id order by player_id) into picks from (
  select player_id from public.fixture_callups where fixture_id=fid and player_id<>self
  order by player_id limit 3) q;
 if cardinality(picks)<>3 then raise exception 'Vote needs 3 teammates'; end if;
 begin perform public.fantasy_vote(fid,self,picks[2],picks[3]);
 exception when others then
  if position('Voto inválido' in sqlerrm)>0 then blocked:=true;else raise;end if;
 end;
 if not blocked then raise exception 'Self-vote was allowed'; end if;
 perform public.fantasy_vote(fid,picks[1],picks[2],picks[3]);
 if (select count(*) from public.locker_votes where fixture_id=fid and voter_user_id=(select voter_id from _mx_user))<>3
 then raise exception 'Correct ballot not recorded'; end if;
end $$;
rollback;