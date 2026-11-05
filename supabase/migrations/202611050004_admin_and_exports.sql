-- Phase 0/1: restricted member management and downloadable audit snapshot.
begin;
create or replace function public.fantasy_admin_participants(p_club uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_data jsonb;
begin
 if not private.is_admin(p_club) then raise exception 'Só administración'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'user_id',m.user_id,'email',u.email,'role',m.role,
   'confirmed',u.email_confirmed_at is not null,
   'last_sign_in_at',u.last_sign_in_at,'joined_at',m.joined_at,
   'linked_player',pa.player_id,'player_name',pl.name
 ) order by m.joined_at desc),'[]'::jsonb) into v_data
 from public.club_memberships m join auth.users u on u.id=m.user_id
 left join public.player_accounts pa on pa.user_id=m.user_id
 left join public.players pl on pl.id=pa.player_id
 where m.club_id=p_club;
 return v_data;
end; $$;

create or replace function public.fantasy_admin_update_participant(
 p_club uuid,p_user uuid,p_role text,p_player uuid default null)
returns void language plpgsql security definer set search_path=''
as $$
declare v_old_role text;v_old_player uuid;v_club uuid;v_active boolean;
begin
 if not private.is_admin(p_club) then raise exception 'Só administración'; end if;
 if p_role not in ('participant','admin') then raise exception 'Rol incorrecto'; end if;
 select role into v_old_role from public.club_memberships
 where club_id=p_club and user_id=p_user for update;
 if not found then raise exception 'Non pertence ao club'; end if;
 select active into v_active from public.seasons where club_id=p_club order by created_at desc limit 1;
 select player_id into v_old_player from public.player_accounts where user_id=p_user;
 if coalesce(v_active,false) and v_old_player is distinct from p_player then
   raise exception 'Non se poden cambiar vínculos de votación coa tempada activa'; end if;
 if v_old_role='admin' and p_role<>'admin' and
   (select count(*) from public.club_memberships where club_id=p_club and role='admin')<=1 then
   raise exception 'Debe quedar como mínimo unha conta administradora'; end if;
 if p_player is not null then
   select club_id into v_club from public.players where id=p_player;
   if v_club is distinct from p_club then raise exception 'Xogador non pertence ao club'; end if;
   if exists(select 1 from public.player_accounts where player_id=p_player and user_id<>p_user) then
     raise exception 'Este xogador xa está vinculado a outra conta'; end if;
 end if;
 if v_old_player is distinct from p_player and
   exists(select 1 from public.locker_votes where voter_user_id=p_user) then
   raise exception 'Non se pode cambiar o vínculo despois de ter votado'; end if;
 update public.club_memberships set role=p_role where club_id=p_club and user_id=p_user;
 if v_old_player is distinct from p_player then
   delete from public.player_accounts where user_id=p_user;
   if p_player is not null then
     insert into public.player_accounts(player_id,user_id) values(p_player,p_user);
   end if;
 end if;
 insert into public.fantasy_audit(club_id,actor_id,event_type,details)
 values(p_club,auth.uid(),'update_participant',
 jsonb_build_object('user',p_user,'old_role',v_old_role,'role',p_role,
 'old_player',v_old_player,'player',p_player));
end; $$;

create or replace function public.fantasy_admin_revoke_participant(p_club uuid,p_user uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_role text;
begin
 if not private.is_admin(p_club) then raise exception 'Só administración'; end if;
 select role into v_role from public.club_memberships
 where club_id=p_club and user_id=p_user for update;
 if not found then raise exception 'Conta non vinculada'; end if;
 if v_role='admin' and (select count(*) from public.club_memberships
   where club_id=p_club and role='admin')<=1 then
    raise exception 'Non se pode retirar a última conta administradora'; end if;
 if exists(select 1 from public.seasons where club_id=p_club and active) then
    raise exception 'Non se pode retirar unha conta coa tempada activa'; end if;
 if exists(select 1 from public.fantasy_teams t join public.seasons s on s.id=t.season_id
   where s.club_id=p_club and t.user_id=p_user) or
   exists(select 1 from public.locker_votes where voter_user_id=p_user) then
    raise exception 'Esta conta ten actividade histórica; non se pode desvincular automaticamente'; end if;
 delete from public.player_accounts where user_id=p_user
 and player_id in (select id from public.players where club_id=p_club);
 delete from public.club_memberships where club_id=p_club and user_id=p_user;
 insert into public.fantasy_audit(club_id,actor_id,event_type,details)
 values(p_club,auth.uid(),'revoke_participant',jsonb_build_object('user',p_user));
end; $$;

-- An admin-readable JSON export is useful for audit/off-site safekeeping,
-- but is NOT a PostgreSQL disaster-recovery backup. Auth secrets & Storage
-- binary objects are deliberately excluded and must be backed up separately.
create or replace function public.fantasy_admin_export(p_club uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_season uuid;
begin
 if not private.is_admin(p_club) then raise exception 'Só administración'; end if;
 select id into v_season from public.seasons
 where club_id=p_club order by created_at desc limit 1;
 if v_season is null then raise exception 'Non hai tempada'; end if;
 return jsonb_build_object(
 'format','redeiras-admin-export-v1','exported_at',now(),'club_id',p_club,
 'warning','Exportacion parcial: non contén contrasinais, sesións nin arquivos de Storage',
 'seasons',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
    from public.seasons x where x.club_id=p_club),
 'players',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
    from public.players x where x.club_id=p_club),
 'player_positions',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
    from public.player_positions x join public.players p on p.id=x.player_id where p.club_id=p_club),
 'members',(select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'role',m.role,
    'email',u.email,'joined_at',m.joined_at)),'[]'::jsonb)
    from public.club_memberships m join auth.users u on u.id=m.user_id where m.club_id=p_club),
 'player_accounts',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
    from public.player_accounts x join public.players p on p.id=x.player_id where p.club_id=p_club),
 'fixtures',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
    from public.fixtures x where x.season_id=v_season),
 'market_prices',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
    from public.market_prices x where x.season_id=v_season),
 'price_history',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
    from public.price_history x where x.season_id=v_season),
 'fantasy_teams',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
    from public.fantasy_teams x where x.season_id=v_season),
 'team_rosters',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
    from public.team_rosters x join public.fantasy_teams t on t.id=x.team_id where t.season_id=v_season),
 'transfers',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
    from public.transfers x join public.fantasy_teams t on t.id=x.team_id where t.season_id=v_season),
 'game_stats',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
    from public.game_stats x join public.fixtures f on f.id=x.fixture_id where f.season_id=v_season),
 'fixture_callups',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
    from public.fixture_callups x join public.fixtures f on f.id=x.fixture_id where f.season_id=v_season),
 'eligible_voters',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
    from public.eligible_voters x join public.fixtures f on f.id=x.fixture_id where f.season_id=v_season),
 'locker_votes',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
    from public.locker_votes x join public.fixtures f on f.id=x.fixture_id where f.season_id=v_season),
 'fixture_lineups',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
    from public.fixture_lineups x join public.fixtures f on f.id=x.fixture_id where f.season_id=v_season),
 'team_round_scores',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
    from public.team_round_scores x join public.fixtures f on f.id=x.fixture_id where f.season_id=v_season),
 'revisions',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
    from public.fantasy_revisions x where x.club_id=p_club),
 'audit',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
    from public.fantasy_audit x where x.club_id=p_club)
 );
end; $$;

revoke all on function public.fantasy_admin_participants(uuid),
 public.fantasy_admin_update_participant(uuid,uuid,text,uuid),
 public.fantasy_admin_revoke_participant(uuid,uuid),
 public.fantasy_admin_export(uuid) from public,anon;
grant execute on function public.fantasy_admin_participants(uuid),
 public.fantasy_admin_update_participant(uuid,uuid,text,uuid),
 public.fantasy_admin_revoke_participant(uuid,uuid),
 public.fantasy_admin_export(uuid) to authenticated;
commit;