-- Migration 006 - operations hardening, season activation, player award metadata
begin;

alter table public.players
 add column if not exists ledicia_awards_before_launch smallint not null default 0
 check(ledicia_awards_before_launch>=0);

update public.players p set ledicia_awards_before_launch=2
from public.clubs c where p.club_id=c.id and c.slug='cb-redeiras' and p.name='Yoel';
update public.players p set ledicia_awards_before_launch=1
from public.clubs c where p.club_id=c.id and c.slug='cb-redeiras' and p.name='Mateo';

create or replace function public.fantasy_activate_season(p_season uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare s public.seasons%rowtype;
begin
 select * into s from public.seasons where id=p_season for update;
 if not found or not private.is_admin(s.club_id) then raise exception 'Só administración'; end if;
 if not exists(select 1 from public.fixtures where season_id=p_season and starts_at is not null and round_number>=s.start_round)
 then raise exception 'Non hai calendario cun horario confirmado'; end if;
 if (select count(*) from public.market_prices mp where mp.season_id=p_season)<5
 then raise exception 'O mercado aínda non ten xogadores abondo'; end if;
 update public.seasons set active=true where id=p_season;
 insert into public.fantasy_audit(club_id,actor_id,event_type,details)
 values(s.club_id,auth.uid(),'activate_season',jsonb_build_object('season',p_season));
end; $$;

-- A helper to convert an explicit local Spanish time to a timezone-safe timestamp,
-- independent of the admin's browser / travel timezone.
create or replace function public.fantasy_local_time(p_clock text)
returns timestamptz language plpgsql immutable set search_path=''
as $$
begin
 if p_clock !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$'
 then raise exception 'Formato YYYY-MM-DDTHH:MM requerido'; end if;
 return p_clock::timestamp at time zone 'Europe/Madrid';
end; $$;

-- Prevent shifting a locked start forward to reopen a market after original tipoff.
create or replace function public.fantasy_set_kickoff(p_fixture uuid,p_time timestamptz,p_reason text)
returns void language plpgsql security definer set search_path=''
as $$
declare f public.fixtures%rowtype; v_club uuid;
begin
 select * into f from public.fixtures where id=p_fixture for update;
 if not found then raise exception 'Partido non atopado'; end if;
 select club_id into v_club from public.seasons where id=f.season_id;
 if not private.is_admin(v_club) then raise exception 'Só administración'; end if;
 if f.status='finalized' or f.ended_at is not null then raise exception 'Partido rematado'; end if;
 if f.starts_at is not null and now()>=f.starts_at then
   raise exception 'Non se pode reabrir o mercado cambiando unha hora xa vencida. Xestiona o aprazamento por separado.';
 end if;
 if p_time is null or char_length(trim(coalesce(p_reason,'')))<3 then
   raise exception 'Hora e motivo obrigatorios'; end if;
 update public.fixtures set starts_at=p_time,status='scheduled' where id=p_fixture;
 insert into public.fantasy_audit(club_id,actor_id,event_type,details)
 values(v_club,auth.uid(),'change_kickoff',jsonb_build_object('fixture',f.id,'old',f.starts_at,'new',p_time,'reason',p_reason));
end; $$;

-- Prevent a guardian-less registration UX from implying legal authorisation:
-- the invitation workflow will require confirmation that the club has verified
-- the needed participation authorisation for minors (when applicable).
-- Consent evidence is NOT stored here yet: store and retain it according to the
-- club's documented legal-basis/retention process outside public tables.

revoke all on function public.fantasy_activate_season(uuid),public.fantasy_local_time(text) from public,anon;
grant execute on function public.fantasy_activate_season(uuid) to authenticated;
-- Local time conversion is safe/side-effect-free; authenticated client may use.
grant execute on function public.fantasy_local_time(text) to authenticated;

commit;
