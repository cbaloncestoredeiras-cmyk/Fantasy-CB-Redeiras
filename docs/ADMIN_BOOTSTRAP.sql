-- Bootstrap de administrador (MANUAL, para SQL Editor).
-- Ejecutar DESPUÉS de migraciones y DESPUÉS de invitar la cuenta por Supabase Auth.
-- No pega contraseñas, no cambia credenciales y no crea usuarios Auth.
do $$
declare v_admin uuid; v_club uuid;
begin
 select id into v_admin
 from auth.users
 where lower(email)='emiliocarballo02@gmail.com'
 limit 1;
 if v_admin is null then
   raise exception 'Crea/invita primero emiliocarballo02@gmail.com en Authentication > Users';
 end if;
 select id into v_club from public.clubs where slug='cb-redeiras';
 if v_club is null then raise exception 'No existe el club: revisa la migración 002'; end if;
 insert into public.club_memberships(club_id,user_id,role)
 values(v_club,v_admin,'admin')
 on conflict(club_id,user_id) do update set role='admin';
 insert into public.profiles(id,display_name)
 values(v_admin,'Administrador Redeiras')
 on conflict(id) do nothing;
end $$;
