-- Fix photo upload/read/delete RLS scope bug in migration 202611050001.
-- In subqueries over public.players p, unqualified "name" resolves to p.name
-- (the athlete's display name), instead of storage.objects.name (object path).
-- Keep photos private, admin-only uploads/deletes, member-only current-photo reads.
begin;

alter policy "fantasy_player_photos_insert" on storage.objects
to authenticated
with check (
  bucket_id='player-photos'
  and exists (
    select 1 from public.players p
    where p.club_id::text=(storage.foldername(storage.objects.name))[1]
      and p.id::text=(storage.foldername(storage.objects.name))[2]
      and private.is_admin(p.club_id)
  )
);

alter policy "fantasy_player_photos_read" on storage.objects
to authenticated
using (
  bucket_id='player-photos'
  and exists (
    select 1 from public.players p
    where p.club_id::text=(storage.foldername(storage.objects.name))[1]
      and p.id::text=(storage.foldername(storage.objects.name))[2]
      and (
        private.is_admin(p.club_id)
        or (private.is_member(p.club_id) and p.photo_path=storage.objects.name)
      )
  )
);

alter policy "fantasy_player_photos_delete" on storage.objects
to authenticated
using (
  bucket_id='player-photos'
  and exists (
    select 1 from public.players p
    where p.club_id::text=(storage.foldername(storage.objects.name))[1]
      and p.id::text=(storage.foldername(storage.objects.name))[2]
      and private.is_admin(p.club_id)
  )
);

commit;
