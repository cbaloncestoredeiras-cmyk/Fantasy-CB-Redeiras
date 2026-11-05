-- Phase 0 security hardening: prevent admin RPC from silently stealing a player's vote identity.
-- SECURITY DEFINER is intentional; per-call checks must remain mandatory.
begin;
create or replace function public.fantasy_add_member(
 p_club uuid,p_email text,p_role text,p_player uuid default null)
returns void language plpgsql security definer set search_path=''
as $$
declare v_id uuid;v_player_club uuid;v_old_role text;
begin
 if not private.is_admin(p_club) then raise exception 'Só administración'; end if;
 if p_role not in ('participant','admin')
    or char_length(trim(coalesce(p_email,'')))<5
    or char_length(trim(coalesce(p_email,'')))>254 then
   raise exception 'Correo ou rol incorrecto'; end if;
 select id into v_id from auth.users where lower(email)=lower(trim(p_email)) limit 1;
 if v_id is null then raise exception 'Primeiro cómpre invitar o usuario desde Auth'; end if;
 select role into v_old_role from public.club_memberships
 where club_id=p_club and user_id=v_id for update;
 if v_old_role='admin' and p_role='participant' and
    (select count(*) from public.club_memberships
      where club_id=p_club and role='admin')<=1 then
   raise exception 'Debe quedar unha conta administradora'; end if;
 if p_player is not null then
   select club_id into v_player_club from public.players where id=p_player and active;
   if v_player_club is distinct from p_club then raise exception 'Xogador doutro club'; end if;
   if exists(select 1 from public.player_accounts where player_id=p_player and user_id<>v_id)
      or exists(select 1 from public.player_accounts where user_id=v_id and player_id<>p_player) then
     raise exception 'O xogador ou a conta xa teñen outra vinculación. Revísao antes de continuar'; end if;
 end if;
 insert into public.club_memberships(club_id,user_id,role) values(p_club,v_id,p_role)
   on conflict(club_id,user_id) do update set role=excluded.role;
 if p_player is not null then
   insert into public.player_accounts(player_id,user_id) values(p_player,v_id)
     on conflict(player_id) do nothing;
 end if;
 insert into public.fantasy_audit(club_id,actor_id,event_type,details)
 values(p_club,auth.uid(),'add_member',jsonb_build_object(
  'user',v_id,'role',p_role,'player',p_player));
end; $$;
revoke all on function public.fantasy_add_member(uuid,text,text,uuid) from public,anon;
grant execute on function public.fantasy_add_member(uuid,text,text,uuid) to authenticated;
commit;