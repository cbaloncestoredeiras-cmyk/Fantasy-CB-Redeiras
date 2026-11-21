-- Desde X7: os tres cambios son as diferenzas NETAS fronte ao quinteto
-- orixinal da xornada, non os orixinais vendidos algunha vez.
-- Recuperar un orixinal devolve unha praza; as operacións e prezos quedan auditados.
-- Non modificar convocatorias nin puntuacións de xornadas finalizadas.

-- Normalizar só a xornada aínda programada: as anteriores quedan intactas.
-- sold_original_ids conserva o nome histórico da columna, pero desde agora
-- representa os orixinais que non están no quinteto ACTUAL.
update private.fantasy_round_originals r
set sold_original_ids=coalesce((
  select array_agg(o.id order by o.id)
  from unnest(r.original_ids) o(id)
  where not exists (
    select 1 from public.team_rosters tr
    where tr.team_id=r.team_id and tr.player_id=o.id
  )
),'{}'::uuid[])
from public.fantasy_teams t
join public.fixtures f on f.season_id=t.season_id
where t.id=r.team_id and f.round_number=r.round_number and f.status='scheduled';

create or replace function public.fantasy_transfer_status(p_team uuid)
returns jsonb
language plpgsql stable security definer
set search_path=''
as $function$
declare
 t public.fantasy_teams%rowtype; s public.seasons%rowtype;
 f public.fixtures%rowtype; v_current uuid[]; v_original uuid[];
 v_missing uuid[]; v_used integer;
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
 select coalesce(array_agg(o.id order by o.id),'{}'::uuid[]) into v_missing
 from unnest(v_original) o(id) where not o.id=any(v_current);
 v_used:=cardinality(v_missing);
 return jsonb_build_object(
   'used',v_used,'remaining',greatest(0,s.max_transfers-v_used),
   'max',s.max_transfers,'round',f.round_number,
   'original_player_ids',v_original,'changed_original_ids',v_missing
 );
end;
$function$;
revoke all on function public.fantasy_transfer_status(uuid) from public,anon,authenticated;
grant execute on function public.fantasy_transfer_status(uuid) to authenticated;

create or replace function public.fantasy_change_lineup(p_team uuid,p_player_ids uuid[])
returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare
 t public.fantasy_teams%rowtype; s public.seasons%rowtype;
 f public.fixtures%rowtype; v_new integer; v_removed integer;
 v_cash integer; v_sales integer; v_buys integer;
 old_ids uuid[];v_original uuid[];v_missing_after uuid[];
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

 -- Fixar o quinteto orixinal unha vez por xornada. A conta procede
 -- sempre da diferenza entre ese quinteto e o quinteto que se confirma.
 v_original:=private.fantasy_initial_five(t.id,f.round_number,old_ids);
 if cardinality(v_original)<>5 then raise exception 'Non se puido reconstruír o quinteto inicial da xornada';end if;
 insert into private.fantasy_round_originals(team_id,round_number,original_ids,sold_original_ids)
 select t.id,f.round_number,v_original,
   coalesce((select array_agg(o.id order by o.id) from unnest(v_original) o(id)
             where not o.id=any(old_ids)),'{}'::uuid[])
 on conflict(team_id,round_number) do nothing;
 select original_ids into v_original
 from private.fantasy_round_originals
 where team_id=t.id and round_number=f.round_number for update;
 select coalesce(array_agg(o.id order by o.id),'{}'::uuid[]) into v_missing_after
 from unnest(v_original) o(id) where not o.id=any(p_player_ids);
 if cardinality(v_missing_after)>s.max_transfers
 then raise exception 'O quinteto só pode ter 3 xogadores diferentes respecto ao inicial da xornada';
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
  update private.fantasy_round_originals set sold_original_ids=v_missing_after
   where team_id=t.id and round_number=f.round_number;
  insert into public.fantasy_audit(club_id,actor_id,event_type,details)
   values(s.club_id,auth.uid(),'lineup_change',
   jsonb_build_object('team',t.id,'round',f.round_number,'players_in_this_operation',v_removed,
    'changed_original_players',cardinality(v_missing_after),'cash',v_cash));
 end if;
 return jsonb_build_object('cash',v_cash,'transfers_left',s.max_transfers-cardinality(v_missing_after),
  'changes_used',cardinality(v_missing_after),'players_swapped',v_removed,'round',f.round_number);
end;
$function$;
revoke all on function public.fantasy_change_lineup(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.fantasy_change_lineup(uuid,uuid[]) to authenticated;

comment on function public.fantasy_change_lineup(uuid,uuid[]) is
 'Desde X7: máximo tres xogadores ausentes do quinteto orixinal; recuperar un deles libera o cambio. Confirmacións ilimitadas co mercado aberto.';
