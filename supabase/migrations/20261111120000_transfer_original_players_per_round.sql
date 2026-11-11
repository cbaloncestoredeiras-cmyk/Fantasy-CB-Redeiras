-- Redeiras: change allowance is 3 DISTINCT players from the original
-- five for each round, NOT 3 confirmation windows or transaction groups.
-- The original five is immutable once an operation is made in that round.
create table if not exists private.fantasy_round_originals (
 team_id uuid not null references public.fantasy_teams(id) on delete cascade,
 round_number smallint not null,
 original_ids uuid[] not null,
 sold_original_ids uuid[] not null default '{}'::uuid[],
 created_at timestamptz not null default now(),
 primary key(team_id,round_number),
 constraint original_roster_five check (cardinality(original_ids)=5),
 constraint changed_original_cap check(cardinality(sold_original_ids)<=3)
);
revoke all on private.fantasy_round_originals from public,anon,authenticated;

create or replace function private.fantasy_initial_five(p_team uuid,p_round smallint,p_current uuid[])
returns uuid[]
language plpgsql stable security definer
set search_path=''
as $function$
declare
 v_original uuid[];
 v_season uuid;
 v_r record;
begin
 select original_ids into v_original from private.fantasy_round_originals
  where team_id=p_team and round_number=p_round;
 if found then return v_original; end if;

 select season_id into v_season from public.fantasy_teams where id=p_team;
 select array_agg(l.player_id order by l.player_id) into v_original
 from public.fixture_lineups l where l.team_id=p_team
   and l.fixture_id=(
     select f.id from public.fixtures f where f.season_id=v_season
     and f.round_number<p_round and f.status='finalized'
     order by f.round_number desc limit 1
   );
 if cardinality(v_original)=5 then return v_original; end if;

 -- First-round and late-joining teams have no preceding locked fixture.
 -- Rewind the ACTUAL audit pairs in reverse chronological order.
 v_original:=p_current;
 for v_r in select sold_player_id,bought_player_id
   from public.transfers where team_id=p_team and round_number=p_round
   order by executed_at desc,id desc
 loop
   if v_r.bought_player_id=any(v_original) then
     v_original:=array_append(array_remove(v_original,v_r.bought_player_id),v_r.sold_player_id);
   end if;
 end loop;
 return v_original;
end;
$function$;
revoke all on function private.fantasy_initial_five(uuid,smallint,uuid[]) from public,anon,authenticated;

-- Safe server-owned read model used by HOME and MERCADO. No other team is exposed.
create or replace function public.fantasy_transfer_status(p_team uuid)
returns jsonb
language plpgsql stable security definer
set search_path=''
as $function$
declare
 t public.fantasy_teams%rowtype; s public.seasons%rowtype;
 f public.fixtures%rowtype; v_current uuid[]; v_original uuid[];
 v_sold uuid[]; v_limit integer;
begin
 select * into t from public.fantasy_teams
   where id=p_team and user_id=auth.uid();
 if not found then raise exception 'Non es o propietario deste equipo' using errcode='42501';end if;
 select * into s from public.seasons where id=t.season_id;
 if not private.is_member(s.club_id) then raise exception 'Sen invitación activa' using errcode='42501';end if;
 select * into f from public.fixtures
 where season_id=s.id and round_number>=s.start_round
 and status not in('finalized','cancelled')
 order by round_number limit 1;
 if not found then
   return jsonb_build_object('used',0,'remaining',s.max_transfers,'max',s.max_transfers,'round',null);
 end if;
 select coalesce(array_agg(player_id),'{}'::uuid[]) into v_current
 from public.team_rosters where team_id=t.id;
 v_original:=private.fantasy_initial_five(t.id,f.round_number,v_current);
 select sold_original_ids into v_sold from private.fantasy_round_originals
 where team_id=t.id and round_number=f.round_number;
 if not found then
  select coalesce(array_agg(distinct z.sold_player_id),'{}'::uuid[])
    into v_sold from public.transfers z
   where z.team_id=t.id and z.round_number=f.round_number
   and z.sold_player_id=any(v_original);
 end if;
 v_limit:=coalesce(cardinality(v_sold),0);
 return jsonb_build_object(
   'used',v_limit,'remaining',greatest(0,s.max_transfers-v_limit),
   'max',s.max_transfers,'round',f.round_number,
   'original_player_ids',v_original,'changed_original_ids',v_sold
 );
end;
$function$;
revoke all on function public.fantasy_transfer_status(uuid) from public,anon,authenticated;
grant execute on function public.fantasy_transfer_status(uuid) to authenticated;

-- Keep all previous validation, balance accounting, auditing and row locks.
create or replace function public.fantasy_change_lineup(p_team uuid,p_player_ids uuid[])
returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare
 t public.fantasy_teams%rowtype; s public.seasons%rowtype;
 f public.fixtures%rowtype; v_new integer; v_removed integer;
 v_cash integer; v_sales integer; v_buys integer;
 old_ids uuid[];v_original uuid[];v_sold_before uuid[];v_sold_after uuid[];
 r record;
begin
 select * into t from public.fantasy_teams
 where id=p_team and user_id=auth.uid() for update;
 if not found then raise exception 'Non es o propietario deste equipo' using errcode='42501';end if;
 select * into s from public.seasons where id=t.season_id;
 if not private.is_member(s.club_id) then raise exception 'Sen invitación activa';end if;
 select * into f from public.fixtures where id=private.active_market(s.id);
 v_new:=private.validate_five(s.id,f.round_number,p_player_ids);
 select array_agg(player_id) into old_ids from public.team_rosters where team_id=t.id;
 if coalesce(cardinality(old_ids),0)<>5 then raise exception 'Quinteto anterior incompleto';end if;
 select count(*) into v_removed from unnest(old_ids) u(id)
 where not u.id=any(p_player_ids);

 -- Do not invent a confirmation count. Fix the original five once per round.
 v_original:=private.fantasy_initial_five(t.id,f.round_number,old_ids);
 if cardinality(v_original)<>5 then raise exception 'Non se puido reconstruír o quinteto inicial da xornada';end if;
 insert into private.fantasy_round_originals(team_id,round_number,original_ids,sold_original_ids)
 select t.id,f.round_number,v_original,
 coalesce((select array_agg(distinct tr.sold_player_id) from public.transfers tr
   where tr.team_id=t.id and tr.round_number=f.round_number
     and tr.sold_player_id=any(v_original)),'{}'::uuid[])
 on conflict(team_id,round_number) do nothing;
 select original_ids,sold_original_ids into v_original,v_sold_before
 from private.fantasy_round_originals
 where team_id=t.id and round_number=f.round_number for update;
 select coalesce(array_agg(distinct u.id),'{}'::uuid[]) into v_sold_after
 from unnest(v_sold_before||
   coalesce((select array_agg(x.id) from unnest(old_ids) x(id)
     where not x.id=any(p_player_ids) and x.id=any(v_original)),'{}'::uuid[])) u(id);
 if cardinality(v_sold_after)>s.max_transfers
 then raise exception 'Só podes substituír 3 xogadores do quinteto inicial nesta xornada';
 end if;

 select coalesce(sum(mp.price),0) into v_sales from unnest(old_ids) u(id)
 join public.market_prices mp on mp.player_id=u.id and mp.season_id=s.id
 where not u.id=any(p_player_ids);
 select coalesce(sum(mp.price),0) into v_buys from unnest(p_player_ids) u(id)
 join public.market_prices mp on mp.player_id=u.id and mp.season_id=s.id
 where not u.id=any(old_ids);
 v_cash:=t.cash+v_sales-v_buys;
 if v_cash<0 then raise exception 'Saldo insuficiente';end if;
 if v_removed<>(select count(*) from unnest(p_player_ids) u(id) where not u.id=any(old_ids))
 then raise exception 'Cambio de quinteto incorrecto';end if;
 if v_removed>0 then
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
  join public.market_prices mp on mp.player_id=p.id and mp.season_id=s.id
  where p.id=any(p_player_ids);
  update public.fantasy_teams set cash=v_cash where id=t.id;
  update private.fantasy_round_originals set sold_original_ids=v_sold_after
   where team_id=t.id and round_number=f.round_number;
  insert into public.fantasy_audit(club_id,actor_id,event_type,details)
   values(s.club_id,auth.uid(),'lineup_change',
   jsonb_build_object('team',t.id,'round',f.round_number,'players_in_this_operation',v_removed,
    'changed_original_players',cardinality(v_sold_after),'cash',v_cash));
 end if;
 return jsonb_build_object('cash',v_cash,'transfers_left',s.max_transfers-cardinality(v_sold_after),
  'changes_used',cardinality(v_sold_after),'players_swapped',v_removed,'round',f.round_number);
end;
$function$;
revoke all on function public.fantasy_change_lineup(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.fantasy_change_lineup(uuid,uuid[]) to authenticated;

comment on function public.fantasy_change_lineup(uuid,uuid[]) is
 'Cada xornada permite cambiar como máximo tres xogadores DISTINTOS do quinteto inicial, en tantas confirmacións como fagan falta.';
