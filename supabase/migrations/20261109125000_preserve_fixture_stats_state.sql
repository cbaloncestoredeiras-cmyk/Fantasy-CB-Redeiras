-- Gardar de novo o final non debe facer retroceder unha xornada con estatísticas completas.
-- O peche anticipado admite o estado retrocedido se as validacións se cumpren.
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
 update public.fixtures set ended_at=p_time,team_won=p_won,
    status=case when f.stats_finalized_at is not null
      and (select count(*) from public.game_stats g where g.fixture_id=f.id)
       = (select count(*) from public.market_prices m where m.season_id=f.season_id)
      then 'awaiting_votes' else 'awaiting_stats' end
  where id=p_fixture;
 insert into public.fantasy_audit(club_id,actor_id,event_type,details)
 values(v_club,auth.uid(),'set_match_end',jsonb_build_object('fixture',p_fixture,'ended_at',p_time,'won',p_won));
end; $function$;

CREATE OR REPLACE FUNCTION public.fantasy_close_votes_early(p_fixture uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if f.status not in ('awaiting_votes','awaiting_stats') or f.ended_at is null or f.ended_at>now() or f.team_won is null then
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

  update public.fixtures set votes_finalized_at=now(),status='awaiting_votes' where id=f.id;
  insert into public.fantasy_audit(club_id,actor_id,event_type,details)
    values(v_club,auth.uid(),'close_votes_early',
      jsonb_build_object('fixture',f.id,'round',f.round_number,
        'eligible',v_expected,'complete',v_complete));
  return jsonb_build_object('fixture_id',f.id,'eligible',v_expected,
    'voted',v_complete,'closed',true);
end;
$function$;
