-- Migration 008 - restrict profile writes to invited club members.
-- Never allow an arbitrary authenticated account to create application profile rows.
begin;
create or replace function public.fantasy_set_alias(p_alias text)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or char_length(trim(coalesce(p_alias,''))) not between 2 and 40
 then raise exception 'Alias incorrecto'; end if;
 if not exists (
    select 1 from public.club_memberships m where m.user_id=auth.uid()
 ) then
   raise exception 'Conta sen invitación activa';
 end if;
 insert into public.profiles(id,display_name) values(auth.uid(),trim(p_alias))
 on conflict(id) do update set display_name=excluded.display_name;
end; $$;
revoke all on function public.fantasy_set_alias(text) from public,anon;
grant execute on function public.fantasy_set_alias(text) to authenticated;
commit;
