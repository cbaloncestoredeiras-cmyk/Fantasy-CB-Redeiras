-- Transactional integration exercise. REQUIRES the Phase 0/1 migrations.
-- Only execute on a trusted test database. Contains BEGIN + ROLLBACK;
-- the test aborts on failure and never calls COMMIT.
begin;
set local statement_timeout='45s';
create temp table _fantasy_test_fixture(id uuid);
create temp table _fantasy_test_team(id uuid);
create temp table _fantasy_test_users(admin_id uuid,participant_id uuid);
insert into _fantasy_test_users
select (select user_id from public.club_memberships where role='admin' order by joined_at limit 1),
       (select user_id from public.club_memberships where role='participant' order by joined_at limit 1);
do $$
begin
 if not exists(select 1 from _fantasy_test_users where admin_id is not null and participant_id is not null)
 then raise exception 'Test needs one admin and one participant'; end if;
 if (select count(*) from public.players)<5 then raise exception 'Test needs at least five players'; end if;
end $$;
-- Activation is reversible, and does NOT persist or affect real participants.
update public.seasons set active=true where id=(select id from public.seasons order by created_at desc limit 1);
with f as (
 insert into public.fixtures(season_id,round_number,opponent,starts_at,ended_at,status,stats_finalized_at,team_won)
 select id,1,'__FANTASY_TRANSACTION_TEST__',now()-interval '5 days',
        now()-interval '4 days','awaiting_votes',now()-interval '4 days',true
 from public.seasons order by created_at desc limit 1 returning id)
insert into _fantasy_test_fixture select id from f;
insert into public.fixture_callups(fixture_id,player_id)
select (select id from _fantasy_test_fixture),p.id from public.players p
join public.seasons s on p.club_id=s.club_id
where s.id=(select season_id from public.fixtures where id=(select id from _fantasy_test_fixture))
order by p.name limit 12;
insert into public.game_stats(fixture_id,player_id,minutes,pir,played,source_format)
select (select id from _fantasy_test_fixture),p.id,
 case when row_number() over(order by p.name)<=5 then 20 else 0 end,
 case when row_number() over(order by p.name)<=5 then 10 else 0 end,
 row_number() over(order by p.name)<=5,'manual'
from public.players p where p.club_id=(select s.club_id from public.seasons s
 where s.id=(select season_id from public.fixtures where id=(select id from _fantasy_test_fixture)));
with t as (
 insert into public.fantasy_teams(season_id,user_id,name,cash)
 select s.id,u.admin_id,'__FANTASY_TEST_TEAM__',1000000
 from public.seasons s,_fantasy_test_users u
 where s.id=(select season_id from public.fixtures where id=(select id from _fantasy_test_fixture))
 returning id)
insert into _fantasy_test_team select id from t;
insert into public.team_rosters(team_id,player_id,purchase_price)
select (select id from _fantasy_test_team),p.id,500000 from public.players p
where p.club_id=(select s.club_id from public.seasons s where s.id=
 (select season_id from public.fixtures where id=(select id from _fantasy_test_fixture)))
order by p.name limit 5;
grant select on _fantasy_test_fixture,_fantasy_test_team,_fantasy_test_users to authenticated;
select set_config('request.jwt.claim.sub',(select admin_id::text from _fantasy_test_users),true);
set local role authenticated;
do $$
declare fid uuid:=(select id from _fantasy_test_fixture);pre jsonb;corrected jsonb;post jsonb;
begin
 pre:=public.fantasy_preview_fixture(fid,null);
 if jsonb_array_length(pre->'players')<>18 or jsonb_array_length(pre->'teams')<>1 then
   raise exception 'Unexpected preview dimensions'; end if;
 perform public.fantasy_publish_fixture(fid);
 post:=public.fantasy_preview_fixture(fid,null);
 if (select status from public.fixtures where id=fid)<>'finalized' then raise exception 'Publish failed'; end if;
 if (select count(*) from public.price_history where season_id=
 (select season_id from public.fixtures where id=fid) and round_number=1)<>18
 then raise exception 'Prices not fully published'; end if;
 if (select count(*) from public.fixture_lineups where fixture_id=fid)<>5 then raise exception 'Lineup not frozen'; end if;
 if (select count(*) from public.team_round_scores where fixture_id=fid)<>1 then raise exception 'Team score missing'; end if;
 if pre->'teams' is distinct from post->'teams' then raise exception 'Preview and stored points differ'; end if;
 select jsonb_agg(jsonb_build_object('player_id',g.player_id,'played',g.played,
 'minutes',g.minutes,'pir',case when g.played then 12 else g.pir end,
 'points',g.points)) into corrected from public.game_stats g where g.fixture_id=fid;
 perform public.fantasy_correct_fixture(fid,corrected,'Rectificación simulada e controlada');
 if (select count(*) from public.fantasy_revisions where fixture_id=fid)<>1 then
   raise exception 'Revision not audited'; end if;
 if (select count(*) from public.price_history where round_number=1)<>18 then raise exception 'Duplicate prices'; end if;
end $$;
-- A later-created team must prevent retroactive changes to prices used for its cash.
reset role;
insert into public.fantasy_teams(season_id,user_id,name,cash,created_at)
select f.season_id,u.participant_id,'__FANTASY_LATE_TEST__',0,now()+interval '2 seconds'
from public.fixtures f,_fantasy_test_users u where f.id=(select id from _fantasy_test_fixture);
select set_config('request.jwt.claim.sub',(select admin_id::text from _fantasy_test_users),true);
set local role authenticated;
do $$
declare fid uuid:=(select id from _fantasy_test_fixture);data jsonb;blocked boolean:=false;
begin
 select jsonb_agg(jsonb_build_object('player_id',g.player_id,'played',g.played,
 'minutes',g.minutes,'pir',g.pir,'points',g.points))
 into data from public.game_stats g where g.fixture_id=fid;
 begin
  perform public.fantasy_correct_fixture(fid,data,'Corrección bloqueada por inscrición posterior');
 exception when others then
  if position('Rectificación bloqueada' in sqlerrm)>0 then blocked:=true;else raise;end if;
 end;
 if not blocked then raise exception 'Unsafe correction after later team was permitted';end if;
end $$;
-- Auth and RLS negative checks.
select set_config('request.jwt.claim.sub',(select participant_id::text from _fantasy_test_users),true);
do $$
declare fid uuid:=(select id from _fantasy_test_fixture);denied boolean;
begin
 denied:=false;
 begin
   perform public.fantasy_preview_fixture(fid,null);
 exception when others then
   if position('Só administración' in sqlerrm)>0 then denied:=true;else raise;end if;
 end;
 if not denied then raise exception 'Participant was allowed to preview'; end if;
 denied:=false;
 begin
   perform public.fantasy_admin_export((select id from public.clubs limit 1));
 exception when others then
   if position('Só administración' in sqlerrm)>0 then denied:=true;else raise;end if;
 end;
 if not denied then raise exception 'Participant was allowed export'; end if;
 if (select count(*) from public.team_rosters
     where team_id=(select id from _fantasy_test_team))>0 then
   raise exception 'Participant read someone else roster'; end if;
end $$;
rollback;
