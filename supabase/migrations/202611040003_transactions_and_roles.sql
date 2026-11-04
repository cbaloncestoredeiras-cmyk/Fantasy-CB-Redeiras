-- Migration 003 - playable competition core
-- Requires 001 and 002. Transactional/RLS functions deliberately deny anonymous writes.
begin;

alter table public.players add column if not exists available_from_round smallint not null default 5 check(available_from_round > 0);
alter table public.fixtures add column if not exists team_won boolean;
alter table public.game_stats add column if not exists played boolean not null default false;
alter table public.game_stats add column if not exists vote_bonus numeric(6,2) not null default 0;

create table if not exists public.fixture_lineups(
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  team_id uuid not null references public.fantasy_teams(id) on delete cascade,
  player_id uuid not null references public.players(id),
  locked_at timestamptz not null default now(),
  primary key(fixture_id,team_id,player_id)
);

create table if not exists public.fixture_callups(
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  primary key(fixture_id,player_id)
);

create table if not exists public.fantasy_audit(
  id bigint generated always as identity primary key,
  club_id uuid not null references public.clubs(id),
  actor_id uuid references auth.users(id),
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists fantasy_audit_club_date on public.fantasy_audit(club_id,created_at desc);

alter table public.fixture_lineups enable row level security;
alter table public.fixture_callups enable row level security;
alter table public.fantasy_audit enable row level security;
create policy my_locked_lineups on public.fixture_lineups for select to authenticated
using (exists(select 1 from public.fantasy_teams t where t.id=team_id and t.user_id=(select auth.uid())));
create policy round_callups_for_members on public.fixture_callups for select to authenticated
using(exists(select 1 from public.fixtures f join public.seasons s on s.id=f.season_id where f.id=fixture_id and private.is_member(s.club_id)));
-- Audit log is admin-only.
create policy admin_audit_read on public.fantasy_audit for select to authenticated
using(private.is_admin(club_id));

-- RLS on public tables remains read-only. No frontend INSERT/UPDATE/DELETE policies.
create or replace function private.active_market(p_season uuid)
returns uuid language plpgsql stable security definer set search_path=''
as $$
declare f record; v_start_round integer; v_previous_pending boolean;
begin
 select start_round into v_start_round from public.seasons where id=p_season and active;
 if not found then raise exception 'Temporada non activada polo club'; end if;
 select id,starts_at,round_number into f from public.fixtures
 where season_id=p_season and round_number >= v_start_round
 and status='scheduled'
 order by round_number limit 1;
 if not found or f.starts_at is null or now()>=f.starts_at then
   raise exception 'Mercado pechado ou sen horario confirmado';
 end if;
 select exists(select 1 from public.fixtures
   where season_id=p_season and round_number>=v_start_round
    and round_number<f.round_number and status<>'finalized')
 into v_previous_pending;
 if v_previous_pending then raise exception 'Hai estatísticas ou prezos pendentes da xornada anterior'; end if;
 return f.id;
end; $$;

create or replace function private.validate_five(p_season uuid,p_round integer,p_ids uuid[])
returns integer language plpgsql stable security definer set search_path=''
as $$
declare v_club uuid; v_count integer; v_total integer; v_has_ba boolean; v_has_inside boolean;
begin
 if p_ids is null or cardinality(p_ids)<>5 or
   (select count(distinct x) from unnest(p_ids) u(x))<>5 then
   raise exception 'É necesario un quinteto de 5 xogadores diferentes';
 end if;
 select club_id into v_club from public.seasons where id=p_season;
 select count(*),coalesce(sum(mp.price),0),
  bool_or(pp.position='BA'),
  bool_or(pp.position in ('AP','P'))
 into v_count,v_total,v_has_ba,v_has_inside
 from public.players p
 join public.market_prices mp on mp.player_id=p.id and mp.season_id=p_season
 left join public.player_positions pp on pp.player_id=p.id
 where p.id=any(p_ids) and p.club_id=v_club and p.active and p.available_from_round<=p_round;
 -- Sum over distinct players: joining positions would otherwise double prices.
 select count(*),coalesce(sum(mp.price),0) into v_count,v_total
 from public.players p join public.market_prices mp on mp.player_id=p.id and mp.season_id=p_season
 where p.id=any(p_ids) and p.club_id=v_club and p.active and p.available_from_round<=p_round;
 if v_count<>5 then raise exception 'Algún xogador non está dispoñible no mercado'; end if;
 select exists(select 1 from public.players p join public.player_positions pp on pp.player_id=p.id
  where p.id=any(p_ids) and pp.position='BA')
  into v_has_ba;
 select exists(select 1 from public.players p join public.player_positions pp on pp.player_id=p.id
  where p.id=any(p_ids) and pp.position in ('AP','P'))
  into v_has_inside;
 if not v_has_ba or not v_has_inside then
   raise exception 'Debes ter un BA e un AP/P';
 end if;
 if not exists(
   select 1 from public.player_positions b join public.player_positions i on b.player_id<>i.player_id
   where b.player_id=any(p_ids) and b.position='BA'
     and i.player_id=any(p_ids) and i.position in ('AP','P')
 ) then raise exception 'BA e interior deben ser xogadores diferentes'; end if;
 return v_total;
end; $$;

create or replace function public.fantasy_create_team(p_season uuid,p_name text,p_player_ids uuid[])
returns uuid language plpgsql security definer set search_path=''
as $$
declare s public.seasons%rowtype; f public.fixtures%rowtype; v_price integer; v_id uuid;
begin
 select * into s from public.seasons where id=p_season;
 if not found or auth.uid() is null or not private.is_member(s.club_id) then raise exception 'Sen invitación activa'; end if;
 if char_length(trim(coalesce(p_name,''))) not between 2 and 40 then raise exception 'Nome do equipo non válido'; end if;
 select * into f from public.fixtures where id=private.active_market(p_season);
 v_price:=private.validate_five(p_season,f.round_number,p_player_ids);
 if v_price>s.starting_budget then raise exception 'O quinteto supera o orzamento inicial'; end if;
 insert into public.fantasy_teams(season_id,user_id,name,cash)
 values(p_season,auth.uid(),trim(p_name),s.starting_budget-v_price)
 returning id into v_id;
 insert into public.team_rosters(team_id,player_id,purchase_price)
 select v_id,p.id,mp.price from public.players p
 join public.market_prices mp on mp.player_id=p.id and mp.season_id=p_season
 where p.id=any(p_player_ids);
 insert into public.fantasy_audit(club_id,actor_id,event_type,details)
 values(s.club_id,auth.uid(),'create_team',jsonb_build_object('team_id',v_id,'round',f.round_number));
 return v_id;
end; $$;

create or replace function public.fantasy_change_lineup(p_team uuid,p_player_ids uuid[])
returns jsonb language plpgsql security definer set search_path=''
as $$
declare t public.fantasy_teams%rowtype; s public.seasons%rowtype;
 f public.fixtures%rowtype; v_new integer; v_removed int; v_used int;
 v_cash integer; v_sales integer; v_buys integer; old_ids uuid[]; r record;
begin
 select * into t from public.fantasy_teams where id=p_team and user_id=auth.uid() for update;
 if not found then raise exception 'Non es o propietario deste equipo'; end if;
 select * into s from public.seasons where id=t.season_id;
 if not private.is_member(s.club_id) then raise exception 'Sen invitación activa'; end if;
 select * into f from public.fixtures where id=private.active_market(s.id);
 v_new:=private.validate_five(s.id,f.round_number,p_player_ids);
 select array_agg(player_id) into old_ids from public.team_rosters where team_id=t.id;
 if coalesce(cardinality(old_ids),0)<>5 then raise exception 'Quinteto anterior incompleto'; end if;
 select count(*) into v_removed from unnest(old_ids) u(id) where not u.id=any(p_player_ids);
 select count(*) into v_used from public.transfers where team_id=t.id and round_number=f.round_number;
 if v_used+v_removed>s.max_transfers then raise exception 'Só se permiten 3 fichaxes nesta xornada'; end if;
 select coalesce(sum(mp.price),0) into v_sales from unnest(old_ids) u(id)
 join public.market_prices mp on mp.player_id=u.id and mp.season_id=s.id
 where not u.id=any(p_player_ids);
 select coalesce(sum(mp.price),0) into v_buys from unnest(p_player_ids) u(id)
 join public.market_prices mp on mp.player_id=u.id and mp.season_id=s.id
 where not u.id=any(old_ids);
 v_cash:=t.cash+v_sales-v_buys;
 if v_cash<0 then raise exception 'Saldo insuficiente'; end if;
 if v_removed<> (select count(*) from unnest(p_player_ids) u(id) where not u.id=any(old_ids))
 then raise exception 'Cambio de quinteto incorrecto'; end if;
 -- Correspond sold and bought players deterministically for audit; each pair counts 1 transfer.
 for r in
  with sales as (select x.id,row_number() over(order by x.id) idx from unnest(old_ids) x(id)
  where not x.id=any(p_player_ids)),
  buys as (select x.id,row_number() over(order by x.id) idx from unnest(p_player_ids) x(id)
  where not x.id=any(old_ids))
  select sales.id as old_id,buys.id as new_id from sales join buys using(idx)
 loop
  insert into public.transfers(team_id,round_number,sold_player_id,bought_player_id,sale_price,purchase_price)
  select t.id,f.round_number,r.old_id,r.new_id,
  (select price from public.market_prices where season_id=s.id and player_id=r.old_id),
  (select price from public.market_prices where season_id=s.id and player_id=r.new_id);
 end loop;
 delete from public.team_rosters where team_id=t.id;
 insert into public.team_rosters(team_id,player_id,purchase_price)
 select t.id,p.id,mp.price from public.players p
 join public.market_prices mp on mp.player_id=p.id and mp.season_id=s.id where p.id=any(p_player_ids);
 update public.fantasy_teams set cash=v_cash where id=t.id;
 insert into public.fantasy_audit(club_id,actor_id,event_type,details)
 values(s.club_id,auth.uid(),'lineup_change',
 jsonb_build_object('team',t.id,'round',f.round_number,'changes',v_removed,'cash',v_cash));
 return jsonb_build_object('cash',v_cash,'transfers_left',s.max_transfers-v_used-v_removed,'round',f.round_number);
end; $$;

create or replace function public.fantasy_set_kickoff(p_fixture uuid,p_time timestamptz,p_reason text)
returns void language plpgsql security definer set search_path=''
as $$
declare f public.fixtures%rowtype; v_club uuid;
begin
 select * into f from public.fixtures where id=p_fixture for update;
 if not found then raise exception 'Partido non atopado'; end if;
 select club_id into v_club from public.seasons where id=f.season_id;
 if not private.is_admin(v_club) then raise exception 'Só administración'; end if;
 if f.status='finalized' then raise exception 'Partido xa publicado'; end if;
 if p_time is null or char_length(trim(coalesce(p_reason,'')))<3 then raise exception 'Hora e motivo obrigatorios'; end if;
 update public.fixtures set starts_at=p_time,status='scheduled' where id=p_fixture;
 insert into public.fantasy_audit(club_id,actor_id,event_type,details)
 values(v_club,auth.uid(),'change_kickoff',jsonb_build_object('fixture',f.id,'old',f.starts_at,'new',p_time,'reason',p_reason));
end; $$;

create or replace function public.fantasy_set_end(p_fixture uuid,p_time timestamptz,p_won boolean)
returns void language plpgsql security definer set search_path=''
as $$
declare f public.fixtures%rowtype; v_club uuid;
begin
 select * into f from public.fixtures where id=p_fixture for update;
 if not found then raise exception 'Partido non atopado'; end if;
 select club_id into v_club from public.seasons where id=f.season_id;
 if not private.is_admin(v_club) then raise exception 'Só administración'; end if;
 if f.status='finalized' then raise exception 'Partido xa publicado'; end if;
 if f.starts_at is null or p_time<f.starts_at or p_time>now() or p_won is null then
  raise exception 'Final do partido ou resultado non válido'; end if;
 update public.fixtures set ended_at=p_time,team_won=p_won,status='awaiting_stats' where id=p_fixture;
 insert into public.fantasy_audit(club_id,actor_id,event_type,details)
 values(v_club,auth.uid(),'set_match_end',jsonb_build_object('fixture',p_fixture,'ended_at',p_time,'won',p_won));
end; $$;

create or replace function public.fantasy_add_junior(p_season uuid,p_name text,p_positions text[],p_price int,p_from_round int)
returns uuid language plpgsql security definer set search_path=''
as $$
declare s public.seasons%rowtype; v_id uuid; v_first integer;
begin
 select * into s from public.seasons where id=p_season;
 if not found or not private.is_admin(s.club_id) then raise exception 'Só administración'; end if;
 if length(trim(coalesce(p_name,'')))<2 or length(p_name)>80 or
   p_positions is null or cardinality(p_positions)<1 or cardinality(p_positions)>2 or
   not(p_positions<@ array['BA','ES','AL','AP','P']::text[]) or p_price not between 450000 and 5000000 then
   raise exception 'Nome, posición ou prezo incorrecto'; end if;
 select min(round_number) into v_first from public.fixtures
 where season_id=p_season and status='scheduled' and starts_at>now();
 if v_first is null or p_from_round<v_first then raise exception 'Debe entrar nun mercado futuro'; end if;
 insert into public.players(club_id,name,category,available_from_round)
 values(s.club_id,trim(p_name),'junior',p_from_round) returning id into v_id;
 insert into public.player_positions(player_id,position) select v_id,unnest(p_positions);
 insert into public.market_prices(season_id,player_id,price) values(s.id,v_id,p_price);
 insert into public.fantasy_audit(club_id,actor_id,event_type,details)
 values(s.club_id,auth.uid(),'add_junior',jsonb_build_object('player',v_id,'initial_price',p_price,'from_round',p_from_round));
 return v_id;
end; $$;

-- Authorised member management for users that already exist in Supabase Auth.
create or replace function public.fantasy_add_member(p_club uuid,p_email text,p_role text,p_player uuid default null)
returns void language plpgsql security definer set search_path=''
as $$
declare v_id uuid; v_player_club uuid;
begin
 if not private.is_admin(p_club) then raise exception 'Só administración'; end if;
 if p_role not in ('participant','admin') or char_length(trim(coalesce(p_email,'')))<5 then
  raise exception 'Correo ou rol incorrecto'; end if;
 select id into v_id from auth.users where lower(email)=lower(trim(p_email)) limit 1;
 if v_id is null then raise exception 'Primeiro cómpre invitar o usuario desde Auth'; end if;
 if p_player is not null then
  select club_id into v_player_club from public.players where id=p_player;
  if v_player_club is distinct from p_club then raise exception 'Xogador doutro club'; end if;
 end if;
 insert into public.club_memberships(club_id,user_id,role) values(p_club,v_id,p_role)
 on conflict(club_id,user_id) do update set role=excluded.role;
 if p_player is not null then
  insert into public.player_accounts(player_id,user_id) values(p_player,v_id)
  on conflict(player_id) do update set user_id=excluded.user_id;
 end if;
 insert into public.fantasy_audit(club_id,actor_id,event_type,details)
 values(p_club,auth.uid(),'add_member',jsonb_build_object('role',p_role,'player',p_player));
end; $$;

revoke all on function private.active_market(uuid), private.validate_five(uuid,integer,uuid[]) from public,anon;
revoke all on function public.fantasy_create_team(uuid,text,uuid[]),public.fantasy_change_lineup(uuid,uuid[]),
 public.fantasy_set_kickoff(uuid,timestamptz,text),public.fantasy_set_end(uuid,timestamptz,boolean),
 public.fantasy_add_junior(uuid,text,text[],int,int),public.fantasy_add_member(uuid,text,text,uuid)
 from public,anon;
grant execute on function public.fantasy_create_team(uuid,text,uuid[]),public.fantasy_change_lineup(uuid,uuid[]),
 public.fantasy_set_kickoff(uuid,timestamptz,text),public.fantasy_set_end(uuid,timestamptz,boolean),
 public.fantasy_add_junior(uuid,text,text[],int,int),public.fantasy_add_member(uuid,text,text,uuid)
 to authenticated;

commit;
