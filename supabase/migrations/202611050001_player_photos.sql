-- Player portraits: private storage, membership-gated reads, admin-only uploads.
-- Consent/authorisation for use of photographs must be checked by the club before upload.
begin;

alter table public.players add column if not exists photo_path text;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('player-photos','player-photos',false,4194304,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public=false,file_size_limit=excluded.file_size_limit,
      allowed_mime_types=excluded.allowed_mime_types;

-- A signed-in club member may read ONLY the photograph currently attached to a player.
-- Administrators can also inspect old photos so they can remove them safely.
create policy "fantasy_player_photos_read" on storage.objects
for select to authenticated
using (
  bucket_id='player-photos'
  and exists(
    select 1 from public.players p
    where p.club_id::text=(storage.foldername(name))[1]
      and p.id::text=(storage.foldername(name))[2]
      and (private.is_admin(p.club_id)
           or (private.is_member(p.club_id) and p.photo_path=name))
  )
);

create policy "fantasy_player_photos_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id='player-photos'
  and exists(
    select 1 from public.players p
    where p.club_id::text=(storage.foldername(name))[1]
      and p.id::text=(storage.foldername(name))[2]
      and private.is_admin(p.club_id)
  )
);

create policy "fantasy_player_photos_delete" on storage.objects
for delete to authenticated
using (
  bucket_id='player-photos'
  and exists(
    select 1 from public.players p
    where p.club_id::text=(storage.foldername(name))[1]
      and p.id::text=(storage.foldername(name))[2]
      and private.is_admin(p.club_id)
  )
);

create or replace function public.fantasy_set_player_photo(p_player uuid,p_path text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_club uuid;
begin
  select club_id into v_club from public.players where id=p_player for update;
  if not found then raise exception 'Xogador non atopado'; end if;
  if not private.is_admin(v_club) then raise exception 'Só administración'; end if;
  if p_path is not null then
    if split_part(p_path,'/',1)<>v_club::text
       or split_part(p_path,'/',2)<>p_player::text
       or p_path !~ ('^'||v_club::text||'/'||p_player::text||'/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$')
       or not exists (
         select 1 from storage.objects
         where bucket_id='player-photos' and name=p_path
       )
    then raise exception 'Foto non válida ou non subida'; end if;
  end if;
  update public.players set photo_path=p_path where id=p_player;
end;
$$;
revoke all on function public.fantasy_set_player_photo(uuid,text) from public,anon;
grant execute on function public.fantasy_set_player_photo(uuid,text) to authenticated;

commit;
