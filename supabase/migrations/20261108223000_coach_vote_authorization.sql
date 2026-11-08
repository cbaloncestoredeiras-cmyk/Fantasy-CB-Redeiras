-- Votación 3-2-1 do adestrador, con idéntico peso a cada papeleta do vestiario.
-- Activación: exclusivamente para contas designadas por unha operación administrativa
-- independente. NON se concede automaticamente aos administradores.
create table if not exists private.coach_voters (
 club_id uuid primary key references public.clubs(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 granted_at timestamptz not null default now()
);
alter table private.coach_voters enable row level security;
revoke all on private.coach_voters from public, anon, authenticated;

create or replace function public.fantasy_coach_vote_access(p_club uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $function$
 select auth.uid() is not null
   and private.is_member(p_club)
   and exists (
     select 1 from private.coach_voters cv
     where cv.club_id=p_club and cv.user_id=auth.uid()
       and not exists(select 1 from public.player_accounts pa where pa.user_id=auth.uid())
   );
$function$;

revoke all on function public.fantasy_coach_vote_access(uuid) from public, anon, authenticated;
grant execute on function public.fantasy_coach_vote_access(uuid) to authenticated;
comment on function public.fantasy_coach_vote_access(uuid) is
 'Só indica se a propia conta é adestrador con voto; non revela a identidade doutras contas.';

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
 if not found or f.ended_at is null or now()<f.ended_at or now()>=f.ended_at+interval '72 hours'
 then raise exception 'Fóra das 72 horas de votación'; end if;
 select club_id into v_club from public.seasons where id=f.season_id;
 if not private.is_member(v_club) then raise exception 'Acceso non autorizado'; end if;
 select exists(select 1 from public.eligible_voters
   where fixture_id=p_fixture and user_id=auth.uid()) into v_is_player;
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
 -- Delete then insert atomically: allows reordering earlier selections without a uniqueness race.
 delete from public.locker_votes where fixture_id=p_fixture and voter_user_id=auth.uid();
 insert into public.locker_votes(fixture_id,voter_user_id,recipient_player_id,points)
 values(p_fixture,auth.uid(),p_first,3),(p_fixture,auth.uid(),p_second,2),(p_fixture,auth.uid(),p_third,1);
 insert into public.fantasy_audit(club_id,actor_id,event_type,details)
 values(v_club,auth.uid(),'cast_ballot',jsonb_build_object('fixture',p_fixture));
end; $function$

CREATE OR REPLACE FUNCTION public.fantasy_admin_vote_participation(p_fixture uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_club uuid;
  v_callups integer;
  v_eligible integer;
  v_voted integer;
  v_voters jsonb;
  v_coach_enabled boolean;
  v_coach_voted boolean;
begin
  select s.club_id into v_club
  from public.fixtures f
  join public.seasons s on s.id = f.season_id
  where f.id = p_fixture;

  if v_club is null or not private.is_admin(v_club) then
    raise exception 'Só administración' using errcode = '42501';
  end if;

  select count(*) into v_callups
  from public.fixture_callups
  where fixture_id = p_fixture;

  with voter_status as (
    select e.user_id, coalesce(p.name, 'Conta sen xogador asociado') as name,
           (count(v.recipient_player_id) = 3) as voted
    from public.eligible_voters e
    left join public.player_accounts pa on pa.user_id = e.user_id
    left join public.players p on p.id = pa.player_id and p.club_id = v_club
    left join public.locker_votes v
      on v.fixture_id = e.fixture_id and v.voter_user_id = e.user_id
    where e.fixture_id = p_fixture
    group by e.user_id, p.name
  )
  select count(*)::integer,
         count(*) filter (where voted)::integer,
         coalesce(jsonb_agg(
           jsonb_build_object('name', name, 'voted', voted)
           order by voted, name
         ), '[]'::jsonb)
  into v_eligible, v_voted, v_voters
  from voter_status;

  select exists (
    select 1 from private.coach_voters cv
    join public.club_memberships cm on cm.club_id=cv.club_id and cm.user_id=cv.user_id
    where cv.club_id=v_club
      and not exists(select 1 from public.player_accounts pa where pa.user_id=cv.user_id)
  ) into v_coach_enabled;

  select exists (
    select 1 from private.coach_voters cv
    join public.club_memberships cm on cm.club_id=cv.club_id and cm.user_id=cv.user_id
    where cv.club_id=v_club
      and not exists(select 1 from public.player_accounts pa where pa.user_id=cv.user_id)
      and (select count(*) from public.locker_votes v
        where v.fixture_id=p_fixture and v.voter_user_id=cv.user_id)=3
  ) into v_coach_voted;

  return jsonb_build_object(
    'coach',jsonb_build_object('enabled',v_coach_enabled,'voted',v_coach_voted),
    'fixture_id', p_fixture,
    'eligible', v_eligible,
    'voted', v_voted,
    'pending', v_eligible - v_voted,
    'callups', v_callups,
    'voters', v_voters
  );
end;
$function$

-- Manteñen as mesmas concesións que xa tiñan e validación no servidor.
revoke all on function public.fantasy_vote(uuid,uuid,uuid,uuid) from public,anon;
revoke all on function public.fantasy_admin_vote_participation(uuid) from public,anon,authenticated;
grant execute on function public.fantasy_admin_vote_participation(uuid) to authenticated;
comment on function public.fantasy_admin_vote_participation(uuid) is
 'A administración ve papeletas completas de xogadores e estado do voto do adestrador por separado, nunca destinatarios.';
