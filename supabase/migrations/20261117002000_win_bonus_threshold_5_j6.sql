-- Bonus de vitoria CB Redeiras (dende X6, sen cambios retroactivos).
-- VAL < 5: +1; VAL >= 5: +20%. Só se xogou; a derrota non bonifica.
-- A función é puro cálculo; non modifica estatísticas publicadas nin prezos.
-- Mantense a validación privada e a autorización administrativa existentes.
CREATE OR REPLACE FUNCTION private.fantasy_calculate_fixture(p_fixture uuid, p_rows jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 f public.fixtures%rowtype;s public.seasons%rowtype;p record;t record;
 v_players jsonb:='[]'::jsonb;v_teams jsonb:='[]'::jsonb;v_row jsonb;
 v_called int;v_count int;v_pir numeric;v_min numeric;v_played boolean;
 v_votes numeric;v_bonus numeric;v_victory_bonus numeric;v_score numeric;v_before int;v_after int;
 v_prior_sum numeric;v_prior_count int;v_average numeric;v_total numeric;
begin
 select * into f from public.fixtures where id=p_fixture;
 if not found then raise exception 'Partido non atopado'; end if;
 select * into s from public.seasons where id=f.season_id;
 if not private.is_admin(s.club_id) then raise exception 'Só administración'; end if;
 if f.ended_at is null or f.stats_finalized_at is null or f.team_won is null
    or (now() < f.ended_at + interval '72 hours' and f.votes_finalized_at is null) then
   raise exception 'Agarda ao final das votacións e ás estatísticas completas'; end if;
 select count(*) into v_count from public.market_prices where season_id=s.id;
 if p_rows is not null then
   if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)<>v_count then
     raise exception 'A revisión debe incluír un rexistro por xogador do mercado'; end if;
   if (select count(distinct value->>'player_id') from jsonb_array_elements(p_rows))<>v_count then
     raise exception 'Hai xogadores repetidos ou non identificados'; end if;
 else
   if (select count(*) from public.game_stats where fixture_id=f.id)<>v_count then
     raise exception 'Faltan estatísticas dalgún xogador; revisa antes de publicar'; end if;
 end if;
 select count(*) into v_called from public.fixture_callups where fixture_id=f.id;
 if v_called<3 then raise exception 'Debes gardar primeiro a convocatoria'; end if;
 for p in
   select mp.player_id,mp.price,pl.name from public.market_prices mp
   join public.players pl on pl.id=mp.player_id and pl.club_id=s.club_id
   where mp.season_id=s.id order by pl.name
 loop
   if p_rows is null then
     select to_jsonb(g) into v_row from public.game_stats g
       where g.fixture_id=f.id and g.player_id=p.player_id;
   else
     select value into v_row from jsonb_array_elements(p_rows)
       where value->>'player_id'=p.player_id::text;
   end if;
   if v_row is null then raise exception 'Faltan datos de %',p.name; end if;
   begin
     v_played:=(v_row->>'played')::boolean;
     v_min:=(v_row->>'minutes')::numeric;
     v_pir:=(v_row->>'pir')::numeric;
   exception when others then raise exception 'Datos incorrectos de %',p.name;
   end;
   if v_played is null or v_min is null or v_min not between 0 and 60
       or v_pir is null or v_pir not between -100 and 100
       or (not v_played and (v_min<>0 or v_pir<>0)) then
     raise exception 'Minutos, valoración ou participación incorrectos para %',p.name;
   end if;
   select coalesce(sum(points),0) into v_votes
     from public.locker_votes where fixture_id=f.id and recipient_player_id=p.player_id;
   v_bonus:=case when v_played then round(v_votes/v_called,2) else 0 end;
   -- Vitoria: +1 se VAL < 5; +20% se VAL >= 5. Sen minutos, nada.
   v_victory_bonus:=case when v_played and f.team_won
     then case when v_pir >= 5 then round(v_pir*0.20,2) else 1 end
     else 0 end;
   v_score:=case when v_played then round(v_pir+v_victory_bonus+v_bonus,2) else 0 end;
   if f.status='finalized' then
     select price_before into v_before from public.price_history
       where season_id=s.id and player_id=p.player_id and round_number=f.round_number;
     if v_before is null then raise exception 'Falta o prezo orixinal para rectificar %',p.name; end if;
   else
     v_before:=p.price;
   end if;
   select coalesce(sum(g.fantasy_points),0),count(*) into v_prior_sum,v_prior_count
     from public.game_stats g join public.fixtures prev on prev.id=g.fixture_id
     where g.player_id=p.player_id and prev.season_id=s.id
       and prev.round_number<f.round_number and prev.status='finalized'
       and g.played is true and g.fantasy_points is not null;
   v_average:=case when v_played then (v_prior_sum+v_score)/(v_prior_count+1)
     when v_prior_count>0 then v_prior_sum/v_prior_count else null end;
   v_after:=private.next_price(v_before,v_average,v_played);
   v_players:=v_players||jsonb_build_array(jsonb_build_object(
     'player_id',p.player_id,'name',p.name,'played',v_played,
     'minutes',v_min,'pir',v_pir,'votes_received',v_votes,
     'vote_bonus',v_bonus,'victory_bonus',v_victory_bonus,'fantasy_points',v_score,
     'price_before',v_before,'price_after',v_after,
     'accumulated_average',case when v_average is null then null else round(v_average,2) end,
     'played_games',v_prior_count+case when v_played then 1 else 0 end));
 end loop;
 for t in
   select tm.id,tm.name from public.fantasy_teams tm where tm.season_id=s.id
     and (f.status<>'finalized' or exists(
       select 1 from public.team_round_scores rs where rs.team_id=tm.id and rs.fixture_id=f.id
     )) order by tm.name
 loop
   if f.status='finalized' then
     select coalesce(sum((j.value->>'fantasy_points')::numeric),0) into v_total
       from public.fixture_lineups l
       join jsonb_array_elements(v_players) j(value) on j.value->>'player_id'=l.player_id::text
       where l.team_id=t.id and l.fixture_id=f.id;
   else
     select coalesce(sum((j.value->>'fantasy_points')::numeric),0) into v_total
       from public.team_rosters l
       join jsonb_array_elements(v_players) j(value) on j.value->>'player_id'=l.player_id::text
       where l.team_id=t.id;
   end if;
   v_teams:=v_teams||jsonb_build_array(jsonb_build_object(
     'team_id',t.id,'team_name',t.name,'fantasy_points',round(v_total,2)));
 end loop;
 return jsonb_build_object('fixture_id',f.id,'round',f.round_number,'players',v_players,
   'teams',v_teams,'player_count',jsonb_array_length(v_players),
   'team_count',jsonb_array_length(v_teams));
end; $function$;
