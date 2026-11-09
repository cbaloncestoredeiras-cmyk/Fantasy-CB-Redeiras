-- Private admin-only report from locked fixture lineups, never live unpublished rosters.
-- Public popularity continues to hide counts <3 to protect players in this small league.
create or replace function public.fantasy_admin_uncalled_selections(p_fixture uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $function$
declare
  v_fixture public.fixtures%rowtype;
  v_club uuid;
  v_players jsonb;
  v_total integer;
begin
  select * into v_fixture from public.fixtures where id=p_fixture;
  if not found then raise exception 'Xornada non atopada'; end if;
  select club_id into v_club from public.seasons where id=v_fixture.season_id;
  if auth.uid() is null or v_club is null or not private.is_admin(v_club) then
    raise exception 'Só administración' using errcode='42501';
  end if;
  if v_fixture.status<>'finalized' then
    raise exception 'Só se poden consultar quintetos de xornadas publicadas';
  end if;
  select count(distinct l.team_id)::integer into v_total
  from public.fixture_lineups l
  join public.fantasy_teams t on t.id=l.team_id and t.season_id=v_fixture.season_id
  where l.fixture_id=v_fixture.id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'player_id',p.id,
      'player_name',p.name,
      'pick_count',coalesce(picks.amount,0),
      'teams',coalesce(picks.teams,'[]'::jsonb)
    ) order by coalesce(picks.amount,0) desc,p.name
  ),'[]'::jsonb)
  into v_players
  from public.players p
  join public.market_prices m on m.player_id=p.id and m.season_id=v_fixture.season_id
  left join lateral (
    select count(*)::integer amount,
      coalesce(jsonb_agg(jsonb_build_object('name',t.name) order by t.name),'[]'::jsonb) teams
    from public.fixture_lineups l
    join public.fantasy_teams t on t.id=l.team_id and t.season_id=v_fixture.season_id
    where l.fixture_id=v_fixture.id and l.player_id=p.id
  ) picks on true
  where p.club_id=v_club
    and not exists (select 1 from public.fixture_callups fc
      where fc.fixture_id=v_fixture.id and fc.player_id=p.id);

  return jsonb_build_object(
    'fixture_id',v_fixture.id,'round',v_fixture.round_number,
    'total_teams',v_total,'players',v_players
  );
end;
$function$;
revoke all on function public.fantasy_admin_uncalled_selections(uuid) from public,anon,authenticated;
grant execute on function public.fantasy_admin_uncalled_selections(uuid) to authenticated;
comment on function public.fantasy_admin_uncalled_selections(uuid) is
 'Só para administración: xogadores non convocados e nomes de equipos Fantasy que os aliñaron nunha xornada xa publicada.';
