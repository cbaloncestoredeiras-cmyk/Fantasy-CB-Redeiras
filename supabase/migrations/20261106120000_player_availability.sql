-- Sporting availability only, no diagnosis or automatic transfer/price effect.
alter table public.players
 add column if not exists availability_status text not null default 'available',
 add column if not exists availability_weeks smallint,
 add column if not exists availability_updated_at timestamptz;
alter table public.players
 add constraint players_availability_status_valid check (availability_status in ('available','injured','doubtful')),
 add constraint players_availability_weeks_valid check (
  (availability_status='injured' and (availability_weeks is null or availability_weeks between 1 and 52))
  or (availability_status in ('available','doubtful') and availability_weeks is null));
comment on column public.players.availability_status is 'Club-reported sports availability only, no medical diagnoses';
comment on column public.players.availability_weeks is 'Approximate weeks off communicated by club, not a guaranteed return date';
create or replace function public.fantasy_set_player_availability(
 p_player uuid,p_status text,p_weeks integer default null
) returns jsonb language plpgsql security definer set search_path=''
as $body$
declare v_player public.players%rowtype; v_weeks smallint;
begin
 select * into v_player from public.players where id=p_player for update;
 if not found then raise exception 'Xogador non atopado'; end if;
 if auth.uid() is null or not private.is_admin(v_player.club_id) then
   raise exception 'Só administración pode modificar o estado';
 end if;
 if p_status is null or p_status not in ('available','injured','doubtful') then
   raise exception 'Estado incorrecto';
 end if;
 if p_status='injured' then
   if p_weeks is not null and (p_weeks<1 or p_weeks>52) then
     raise exception 'A estimación debe estar entre 1 e 52 semanas';
   end if;
   v_weeks:=p_weeks::smallint;
 elsif p_weeks is not null then
   raise exception 'As semanas só se indican se está lesionado';
 else
   v_weeks:=null;
 end if;
 if v_player.availability_status=p_status and v_player.availability_weeks is not distinct from v_weeks then
   return jsonb_build_object('player_id',p_player,'status',p_status,'weeks',v_weeks,'changed',false);
 end if;
 update public.players set availability_status=p_status,availability_weeks=v_weeks,availability_updated_at=now()
 where id=p_player;
 insert into public.fantasy_audit(club_id,actor_id,event_type,details)
 values(v_player.club_id,auth.uid(),'player_availability_updated',
   jsonb_build_object('player_id',p_player,'from',v_player.availability_status,
     'to',p_status,'previous_weeks',v_player.availability_weeks,'estimated_weeks',v_weeks));
 return jsonb_build_object('player_id',p_player,'status',p_status,'weeks',v_weeks,'changed',true);
end; $body$;
revoke all on function public.fantasy_set_player_availability(uuid,text,integer) from public,anon;
grant execute on function public.fantasy_set_player_availability(uuid,text,integer) to authenticated;
revoke update on public.players from anon,authenticated;
