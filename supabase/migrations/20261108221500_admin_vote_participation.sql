-- Seguimento de votos exclusivo de administradores; non devolve eleccións.
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

  return jsonb_build_object(
    'fixture_id', p_fixture,
    'eligible', v_eligible,
    'voted', v_voted,
    'pending', v_eligible - v_voted,
    'callups', v_callups,
    'voters', v_voters
  );
end;
$function$;

revoke all on function public.fantasy_admin_vote_participation(uuid) from public, anon, authenticated;
grant execute on function public.fantasy_admin_vote_participation(uuid) to authenticated;
comment on function public.fantasy_admin_vote_participation(uuid) is
  'Seguimento exclusivo para administración: participación, sen destinatarios dos votos nin correos.';
