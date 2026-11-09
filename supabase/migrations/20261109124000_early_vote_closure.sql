-- Closure is an irreversible, auditable admin action. At 100% every expected voter has a complete 3-2-1 ballot.
-- Voting by players and the coach stays open for the full 72h unless the admin explicitly closes it.
create or replace function public.fantasy_close_votes_early(p_fixture uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $function$
declare
  f public.fixtures%rowtype;
  v_club uuid;
  v_expected integer;
  v_complete integer;
  v_coach_expected boolean;
begin
  select * into f from public.fixtures where id=p_fixture for update;
  if not found then raise exception 'Partido non atopado'; end if;
  select s.club_id into v_club from public.seasons s where s.id=f.season_id;
  if not private.is_admin(v_club) then
    raise exception 'Só administración pode pechar a votación' using errcode='42501';
  end if;
  if f.status='finalized' or f.votes_finalized_at is not null then
    raise exception 'A votación xa está pechada';
  end if;
  if f.status<>'awaiting_votes' or f.ended_at is null or f.ended_at>now() or f.team_won is null then
    raise exception 'Rexistra primeiro o final do partido e o resultado';
  end if;
  if now()>=f.ended_at+interval '72 hours' then
    raise exception 'O prazo de 72 horas xa rematou; podes calcular directamente a vista previa';
  end if;
  if f.stats_finalized_at is null or
    (select count(*) from public.game_stats g where g.fixture_id=f.id) <>
    (select count(*) from public.market_prices m where m.season_id=f.season_id) then
    raise exception 'Faltan estatísticas completas; non se pode pechar a votación';
  end if;

  -- All called players with a linked account must have been authorized to vote.
  if exists (
    select 1 from public.fixture_callups fc
      join public.player_accounts pa on pa.player_id=fc.player_id
    where fc.fixture_id=f.id
      and not exists(select 1 from public.eligible_voters e
        where e.fixture_id=f.id and e.user_id=pa.user_id)
  ) then raise exception 'Falta habilitar un xogador convocado para votar'; end if;

  -- Coach is not enrolled in eligible_voters until casting their ballot, but
  -- remains a mandatory voter if enabled for this club.
  select exists(
    select 1 from private.coach_voters cv
      join public.club_memberships cm on cm.club_id=cv.club_id and cm.user_id=cv.user_id
    where cv.club_id=v_club
      and not exists(select 1 from public.player_accounts pa where pa.user_id=cv.user_id)
  ) into v_coach_expected;
  if v_coach_expected and not exists(
    select 1 from private.coach_voters cv
      join public.eligible_voters e on e.user_id=cv.user_id and e.fixture_id=f.id
    where cv.club_id=v_club
  ) then raise exception 'Falta o voto do adestrador'; end if;

  -- Reject stale or unrelated eligibility, so 100% represents exactly the players and coach.
  if exists (
    select 1 from public.eligible_voters e
    where e.fixture_id=f.id
      and not exists (
        select 1 from public.player_accounts pa
          join public.fixture_callups fc on fc.player_id=pa.player_id and fc.fixture_id=f.id
        where pa.user_id=e.user_id
      )
      and not exists (
        select 1 from private.coach_voters cv
        where cv.club_id=v_club and cv.user_id=e.user_id
          and not exists(select 1 from public.player_accounts pa where pa.user_id=e.user_id)
      )
  ) then raise exception 'Hai contas habilitadas sen convocatoria válida'; end if;

  select count(*)::integer,
         count(*) filter (where ballot_count=3 and different_recipients=3
             and different_points=3 and point_sum=6)::integer
    into v_expected,v_complete
  from (
    select e.user_id,count(v.recipient_player_id) ballot_count,
           count(distinct v.recipient_player_id) different_recipients,
           count(distinct v.points) different_points,
           coalesce(sum(v.points),0) point_sum
    from public.eligible_voters e
    left join public.locker_votes v on v.fixture_id=e.fixture_id and v.voter_user_id=e.user_id
    where e.fixture_id=f.id
    group by e.user_id
  ) ballots;
  if v_expected=0 or v_expected<>v_complete then
    raise exception 'Aínda non votou o 100 %%: % de % papeletas completas',v_complete,v_expected;
  end if;

  update public.fixtures set votes_finalized_at=now() where id=f.id;
  insert into public.fantasy_audit(club_id,actor_id,event_type,details)
    values(v_club,auth.uid(),'close_votes_early',
      jsonb_build_object('fixture',f.id,'round',f.round_number,
        'eligible',v_expected,'complete',v_complete));
  return jsonb_build_object('fixture_id',f.id,'eligible',v_expected,
    'voted',v_complete,'closed',true);
end;
$function$;
revoke all on function public.fantasy_close_votes_early(uuid) from public,anon,authenticated;
grant execute on function public.fantasy_close_votes_early(uuid) to authenticated;
comment on function public.fantasy_close_votes_early(uuid) is
 'Peche anticipado só para administración se 100% das papeletas 3-2-1 están completas; bloquea novos votos e habilita vista previa.';


-- private.fantasy_calculate_fixture
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
 v_votes numeric;v_bonus numeric;v_score numeric;v_before int;v_after int;
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
   v_score:=case when v_played
     then round(v_pir*(case when f.team_won and v_pir>0 then 1.20 else 1 end)+v_bonus,2)
     else 0 end;
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
     'vote_bonus',v_bonus,'fantasy_points',v_score,
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

-- private.fantasy_persist_fixture_preview
CREATE OR REPLACE FUNCTION private.fantasy_persist_fixture_preview(p_fixture uuid, p_result jsonb, p_correction boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare f public.fixtures%rowtype;s public.seasons%rowtype;v record;v_count int:=0;
begin
 select * into f from public.fixtures where id=p_fixture for update;
 select * into s from public.seasons where id=f.season_id;
 if not private.is_admin(s.club_id) then raise exception 'Só administración'; end if;
 if not p_correction then
   insert into public.fixture_lineups(fixture_id,team_id,player_id)
     select f.id,t.id,r.player_id from public.fantasy_teams t
     join public.team_rosters r on r.team_id=t.id where t.season_id=s.id
     on conflict do nothing;
 end if;
 for v in select value from jsonb_array_elements(p_result->'players')
 loop
   update public.game_stats set fantasy_points=(v.value->>'fantasy_points')::numeric,
     vote_bonus=(v.value->>'vote_bonus')::numeric,revised_at=now()
   where fixture_id=f.id and player_id=(v.value->>'player_id')::uuid;
   if not found then raise exception 'Falta o boxscore para publicar'; end if;
   insert into public.price_history(season_id,player_id,round_number,price_before,
      price_after,change_reason,accumulated_average,played_games)
   values(s.id,(v.value->>'player_id')::uuid,f.round_number,
      (v.value->>'price_before')::integer,(v.value->>'price_after')::integer,
      case when p_correction then 'correction_audited' else 'broker_cumulative_average_v2' end,
      (v.value->>'accumulated_average')::numeric,(v.value->>'played_games')::integer)
   on conflict(season_id,player_id,round_number) do update set
      price_after=excluded.price_after,change_reason=excluded.change_reason,
      accumulated_average=excluded.accumulated_average,played_games=excluded.played_games,
      recorded_at=now();
   update public.market_prices set price=(v.value->>'price_after')::integer,updated_at=now()
     where season_id=s.id and player_id=(v.value->>'player_id')::uuid;
   v_count:=v_count+1;
 end loop;
 for v in select value from jsonb_array_elements(p_result->'teams')
 loop
   insert into public.team_round_scores(team_id,fixture_id,fantasy_points)
     values((v.value->>'team_id')::uuid,f.id,(v.value->>'fantasy_points')::numeric)
   on conflict(team_id,fixture_id) do update set
     fantasy_points=excluded.fantasy_points,finalized_at=now();
 end loop;
 if not p_correction then
   update public.fixtures set status='finalized',votes_finalized_at=coalesce(votes_finalized_at,now()) where id=f.id;
 end if;
 return v_count;
end; $function$;

-- public.fantasy_vote
CREATE OR REPLACE FUNCTION public.fantasy_vote(p_fixture uuid, p_first uuid, p_second uuid, p_third uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare f public.fixtures%rowtype; v_self uuid; v_club uuid; v_count int; v_is_player boolean; v_is_coach boolean;
begin
 if auth.uid() is null then raise exception 'Inicia sesión para votar'; end if;
 select * into f from public.fixtures where id=p_fixture for share;
 if not found or f.status='finalized' or f.votes_finalized_at is not null or f.ended_at is null or now()<f.ended_at or now()>=f.ended_at+interval '72 hours'
 then raise exception 'Fóra das 72 horas de votación'; end if;
 select club_id into v_club from public.seasons where id=f.season_id;
 if not private.is_member(v_club) then raise exception 'Acceso non autorizado'; end if;
 select exists(
   select 1 from public.eligible_voters e
   join public.player_accounts pa on pa.user_id=e.user_id
   join public.fixture_callups fc on fc.fixture_id=e.fixture_id and fc.player_id=pa.player_id
   where e.fixture_id=p_fixture and e.user_id=auth.uid()
 ) into v_is_player;
 select exists(
   select 1 from private.coach_voters cv
   where cv.club_id=v_club and cv.user_id=auth.uid()
     and not exists(select 1 from public.player_accounts pa where pa.user_id=auth.uid())
 ) into v_is_coach;
 if not (v_is_player or v_is_coach) then
   raise exception 'Só votan os convocados ou o adestrador autorizado';
 end if;
 select player_id into v_self from public.player_accounts where user_id=auth.uid();
 if v_self is null and not v_is_coach then raise exception 'Conta non asociada a un xogador'; end if;
 if p_first is null or p_second is null or p_third is null
   or p_first=p_second or p_first=p_third or p_second=p_third
   or v_self=any(array[p_first,p_second,p_third]) then raise exception 'Voto inválido'; end if;
 select count(*) into v_count from public.fixture_callups
 where fixture_id=p_fixture and player_id=any(array[p_first,p_second,p_third]);
 if v_count<>3 then raise exception 'Só se pode votar a tres compañeiros convocados'; end if;
 -- Os votos do adestrador conservan a FK de integridade ao rexistro de habilitación.
 if v_is_coach then
   insert into public.eligible_voters (fixture_id,user_id)
   values(p_fixture,auth.uid()) on conflict do nothing;
 end if;
 -- Delete then insert atomically: allows reordering earlier selections without a uniqueness race.
 delete from public.locker_votes where fixture_id=p_fixture and voter_user_id=auth.uid();
 insert into public.locker_votes(fixture_id,voter_user_id,recipient_player_id,points)
 values(p_fixture,auth.uid(),p_first,3),(p_fixture,auth.uid(),p_second,2),(p_fixture,auth.uid(),p_third,1);
 insert into public.fantasy_audit(club_id,actor_id,event_type,details)
 values(v_club,auth.uid(),'cast_ballot',jsonb_build_object('fixture',p_fixture));
end; $function$;

-- public.fantasy_set_end
CREATE OR REPLACE FUNCTION public.fantasy_set_end(p_fixture uuid, p_time timestamp with time zone, p_won boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare f public.fixtures%rowtype; v_club uuid;
begin
 select * into f from public.fixtures where id=p_fixture for update;
 if not found then raise exception 'Partido non atopado'; end if;
 select club_id into v_club from public.seasons where id=f.season_id;
 if not private.is_admin(v_club) then raise exception 'Só administración'; end if;
 if f.status='finalized' then raise exception 'Partido xa publicado'; end if;
 if f.votes_finalized_at is not null then raise exception 'A votación está pechada e non se pode cambiar o final'; end if;
 if f.starts_at is null or p_time<f.starts_at or p_time>now() or p_won is null then
  raise exception 'Final do partido ou resultado non válido'; end if;
 update public.fixtures set ended_at=p_time,team_won=p_won,status='awaiting_stats' where id=p_fixture;
 insert into public.fantasy_audit(club_id,actor_id,event_type,details)
 values(v_club,auth.uid(),'set_match_end',jsonb_build_object('fixture',p_fixture,'ended_at',p_time,'won',p_won));
end; $function$;