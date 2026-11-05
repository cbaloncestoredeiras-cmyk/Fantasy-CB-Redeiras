-- Phase 1: one authoritative calculator for preview, publishing and audited corrections.
begin;
create table if not exists public.fantasy_revisions(
 id bigint generated always as identity primary key,
 fixture_id uuid not null references public.fixtures(id),
 club_id uuid not null references public.clubs(id),
 actor_id uuid not null references auth.users(id),
 reason text not null check(char_length(trim(reason)) between 10 and 500),
 before_snapshot jsonb not null,after_snapshot jsonb not null,
 created_at timestamptz not null default now()
);
create index if not exists fantasy_revisions_fixture_idx on public.fantasy_revisions(fixture_id,created_at desc);
alter table public.fantasy_revisions enable row level security;
drop policy if exists fantasy_revisions_admin_read on public.fantasy_revisions;
create policy fantasy_revisions_admin_read on public.fantasy_revisions for select to authenticated
 using(private.is_admin(club_id));
grant select on public.fantasy_revisions to authenticated;
revoke insert,update,delete on public.fantasy_revisions from public,anon,authenticated;

create or replace function private.fantasy_calculate_fixture(p_fixture uuid,p_rows jsonb default null)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
 f public.fixtures%rowtype;s public.seasons%rowtype;p record;t record;
 v_players jsonb:='[]'::jsonb;v_teams jsonb:='[]'::jsonb;v_row jsonb;
 v_called int;v_count int;v_pir numeric;v_min numeric;v_played boolean;
 v_votes numeric;v_bonus numeric;v_score numeric;v_before int;v_after int;
 v_prior_sum numeric;v_prior_count int;v_average numeric;v_total numeric;
begin
 select * into f from public.fixtures where id=p_fixture;
 if not found then raise exception 'Partido non atopado'; end if;
 select * into s from public.seasons where id=f.season_id;
 if not private.is_admin(s.club_id) then raise exception 'Só administración'; end if;
 if f.ended_at is null or f.stats_finalized_at is null or f.team_won is null
    or now() < f.ended_at + interval '72 hours' then
   raise exception 'Agarda ao final das votacións e ás estatísticas completas'; end if;
 select count(*) into v_count from public.market_prices where season_id=s.id;
 if p_rows is not null then
   if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)<>v_count then
     raise exception 'A revisión debe incluír un rexistro por xogador do mercado'; end if;
   if (select count(distinct value->>'player_id') from jsonb_array_elements(p_rows))<>v_count then
     raise exception 'Hai xogadores repetidos ou non identificados'; end if;
 else
   if (select count(*) from public.game_stats where fixture_id=f.id)<>v_count then
     raise exception 'Faltan estatísticas dalgún xogador; revisa antes de publicar'; end if;
 end if;
 select count(*) into v_called from public.fixture_callups where fixture_id=f.id;
 if v_called<3 then raise exception 'Debes gardar primeiro a convocatoria'; end if;
 for p in
   select mp.player_id,mp.price,pl.name from public.market_prices mp
   join public.players pl on pl.id=mp.player_id and pl.club_id=s.club_id
   where mp.season_id=s.id order by pl.name
 loop
   if p_rows is null then
     select to_jsonb(g) into v_row from public.game_stats g
       where g.fixture_id=f.id and g.player_id=p.player_id;
   else
     select value into v_row from jsonb_array_elements(p_rows)
       where value->>'player_id'=p.player_id::text;
   end if;
   if v_row is null then raise exception 'Faltan datos de %',p.name; end if;
   begin
     v_played:=(v_row->>'played')::boolean;
     v_min:=(v_row->>'minutes')::numeric;
     v_pir:=(v_row->>'pir')::numeric;
   exception when others then raise exception 'Datos incorrectos de %',p.name;
   end;
   if v_played is null or v_min is null or v_min not between 0 and 60
       or v_pir is null or v_pir not between -100 and 100
       or (not v_played and (v_min<>0 or v_pir<>0)) then
     raise exception 'Minutos, valoración ou participación incorrectos para %',p.name;
   end if;
   select coalesce(sum(points),0) into v_votes
     from public.locker_votes where fixture_id=f.id and recipient_player_id=p.player_id;
   v_bonus:=case when v_played then round(v_votes/v_called,2) else 0 end;
   v_score:=case when v_played
     then round(v_pir*(case when f.team_won and v_pir>0 then 1.20 else 1 end)+v_bonus,2)
     else 0 end;
   if f.status='finalized' then
     select price_before into v_before from public.price_history
       where season_id=s.id and player_id=p.player_id and round_number=f.round_number;
     if v_before is null then raise exception 'Falta o prezo orixinal para rectificar %',p.name; end if;
   else
     v_before:=p.price;
   end if;
   select coalesce(sum(g.fantasy_points),0),count(*) into v_prior_sum,v_prior_count
     from public.game_stats g join public.fixtures prev on prev.id=g.fixture_id
     where g.player_id=p.player_id and prev.season_id=s.id
       and prev.round_number<f.round_number and prev.status='finalized'
       and g.played is true and g.fantasy_points is not null;
   v_average:=case when v_played then (v_prior_sum+v_score)/(v_prior_count+1)
     when v_prior_count>0 then v_prior_sum/v_prior_count else null end;
   v_after:=private.next_price(v_before,v_average,v_played);
   v_players:=v_players||jsonb_build_array(jsonb_build_object(
     'player_id',p.player_id,'name',p.name,'played',v_played,
     'minutes',v_min,'pir',v_pir,'votes_received',v_votes,
     'vote_bonus',v_bonus,'fantasy_points',v_score,
     'price_before',v_before,'price_after',v_after,
     'accumulated_average',case when v_average is null then null else round(v_average,2) end,
     'played_games',v_prior_count+case when v_played then 1 else 0 end));
 end loop;
 for t in
   select t.id,t.name from public.fantasy_teams t where t.season_id=s.id
     and (f.status<>'finalized' or exists(
       select 1 from public.team_round_scores rs where rs.team_id=t.id and rs.fixture_id=f.id
     )) order by t.name
 loop
   if f.status='finalized' then
     select coalesce(sum((j.value->>'fantasy_points')::numeric),0) into v_total
       from public.fixture_lineups l
       join jsonb_array_elements(v_players) j(value) on j.value->>'player_id'=l.player_id::text
       where l.team_id=t.id and l.fixture_id=f.id;
   else
     select coalesce(sum((j.value->>'fantasy_points')::numeric),0) into v_total
       from public.team_rosters l
       join jsonb_array_elements(v_players) j(value) on j.value->>'player_id'=l.player_id::text
       where l.team_id=t.id;
   end if;
   v_teams:=v_teams||jsonb_build_array(jsonb_build_object(
     'team_id',t.id,'team_name',t.name,'fantasy_points',round(v_total,2)));
 end loop;
 return jsonb_build_object('fixture_id',f.id,'round',f.round_number,'players',v_players,
   'teams',v_teams,'player_count',jsonb_array_length(v_players),
   'team_count',jsonb_array_length(v_teams));
end; $$;

create or replace function public.fantasy_preview_fixture(p_fixture uuid,p_rows jsonb default null)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
 return private.fantasy_calculate_fixture(p_fixture,p_rows);
end; $$;

create or replace function private.fantasy_persist_fixture_preview(
  p_fixture uuid,p_result jsonb,p_correction boolean default false)
returns integer language plpgsql security definer set search_path=''
as $$
declare f public.fixtures%rowtype;s public.seasons%rowtype;v record;v_count int:=0;
begin
 select * into f from public.fixtures where id=p_fixture for update;
 select * into s from public.seasons where id=f.season_id;
 if not private.is_admin(s.club_id) then raise exception 'Só administración'; end if;
 if not p_correction then
   insert into public.fixture_lineups(fixture_id,team_id,player_id)
     select f.id,t.id,r.player_id from public.fantasy_teams t
     join public.team_rosters r on r.team_id=t.id where t.season_id=s.id
     on conflict do nothing;
 end if;
 for v in select value from jsonb_array_elements(p_result->'players')
 loop
   update public.game_stats set fantasy_points=(v.value->>'fantasy_points')::numeric,
     vote_bonus=(v.value->>'vote_bonus')::numeric,revised_at=now()
   where fixture_id=f.id and player_id=(v.value->>'player_id')::uuid;
   if not found then raise exception 'Falta o boxscore para publicar'; end if;
   insert into public.price_history(season_id,player_id,round_number,price_before,
      price_after,change_reason,accumulated_average,played_games)
   values(s.id,(v.value->>'player_id')::uuid,f.round_number,
      (v.value->>'price_before')::integer,(v.value->>'price_after')::integer,
      case when p_correction then 'correction_audited' else 'broker_cumulative_average_v2' end,
      (v.value->>'accumulated_average')::numeric,(v.value->>'played_games')::integer)
   on conflict(season_id,player_id,round_number) do update set
      price_after=excluded.price_after,change_reason=excluded.change_reason,
      accumulated_average=excluded.accumulated_average,played_games=excluded.played_games,
      recorded_at=now();
   update public.market_prices set price=(v.value->>'price_after')::integer,updated_at=now()
     where season_id=s.id and player_id=(v.value->>'player_id')::uuid;
   v_count:=v_count+1;
 end loop;
 for v in select value from jsonb_array_elements(p_result->'teams')
 loop
   insert into public.team_round_scores(team_id,fixture_id,fantasy_points)
     values((v.value->>'team_id')::uuid,f.id,(v.value->>'fantasy_points')::numeric)
   on conflict(team_id,fixture_id) do update set
     fantasy_points=excluded.fantasy_points,finalized_at=now();
 end loop;
 if not p_correction then
   update public.fixtures set status='finalized',votes_finalized_at=now() where id=f.id;
 end if;
 return v_count;
end; $$;

create or replace function public.fantasy_publish_fixture(p_fixture uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare f public.fixtures%rowtype;s public.seasons%rowtype;v_preview jsonb;v_count int;
begin
 select * into f from public.fixtures where id=p_fixture for update;
 if not found then raise exception 'Partido non atopado'; end if;
 select * into s from public.seasons where id=f.season_id;
 if not private.is_admin(s.club_id) then raise exception 'Só administración'; end if;
 if f.status='finalized' then raise exception 'A xornada xa está publicada'; end if;
 if exists(select 1 from public.fixtures prev where prev.season_id=s.id
   and prev.round_number>=s.start_round and prev.round_number<f.round_number
   and prev.status<>'finalized') then
   raise exception 'Publica primeiro as xornadas anteriores'; end if;
 v_preview:=private.fantasy_calculate_fixture(p_fixture,null);
 v_count:=private.fantasy_persist_fixture_preview(p_fixture,v_preview,false);
 insert into public.fantasy_audit(club_id,actor_id,event_type,details)
   values(s.club_id,auth.uid(),'publish_round',
   jsonb_build_object('fixture',p_fixture,'round',f.round_number,
                      'players',v_count,'teams',v_preview->'team_count'));
 return jsonb_build_object('players_updated',v_count,'teams_scored',v_preview->'team_count',
                           'round',f.round_number);
end; $$;

create or replace function public.fantasy_correct_fixture(p_fixture uuid,p_rows jsonb,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare f public.fixtures%rowtype;s public.seasons%rowtype;v_before jsonb;
 v_after jsonb;v_row jsonb;v_count int;
begin
 select * into f from public.fixtures where id=p_fixture for update;
 if not found then raise exception 'Partido non atopado'; end if;
 select * into s from public.seasons where id=f.season_id;
 if not private.is_admin(s.club_id) then raise exception 'Só administración'; end if;
 if f.status<>'finalized' then raise exception 'Só se poden rectificar xornadas publicadas'; end if;
 if char_length(trim(coalesce(p_reason,''))) not between 10 and 500 then
   raise exception 'Explica o motivo da rectificación (10-500 caracteres)'; end if;
 if exists(select 1 from public.fixtures prev where prev.season_id=s.id
   and prev.round_number>f.round_number and prev.status='finalized')
   or exists(select 1 from public.transfers tr join public.fantasy_teams t on t.id=tr.team_id
     where t.season_id=s.id and tr.round_number>f.round_number) then
   raise exception 'Rectificación bloqueada: xa existen xornadas ou fichaxes posteriores. Cómpre unha revisión con reconciliación económica'; end if;
 v_before:=private.fantasy_calculate_fixture(p_fixture,null);
 v_after:=private.fantasy_calculate_fixture(p_fixture,p_rows);
 for v_row in select value from jsonb_array_elements(p_rows)
 loop
   update public.game_stats set
      played=(v_row->>'played')::boolean,minutes=(v_row->>'minutes')::numeric,
      pir=(v_row->>'pir')::numeric,points=coalesce((v_row->>'points')::integer,points),
      rebounds=coalesce((v_row->>'rebounds')::integer,rebounds),
      assists=coalesce((v_row->>'assists')::integer,assists),
      steals=coalesce((v_row->>'steals')::integer,steals),
      blocks=coalesce((v_row->>'blocks')::integer,blocks),
      turnovers=coalesce((v_row->>'turnovers')::integer,turnovers),
      revised_at=now()
   where fixture_id=p_fixture and player_id=(v_row->>'player_id')::uuid;
   if not found then raise exception 'Xogador sen estatísticas no partido'; end if;
 end loop;
 v_count:=private.fantasy_persist_fixture_preview(p_fixture,v_after,true);
 insert into public.fantasy_revisions(fixture_id,club_id,actor_id,reason,before_snapshot,after_snapshot)
   values(p_fixture,s.club_id,auth.uid(),trim(p_reason),v_before,v_after);
 insert into public.fantasy_audit(club_id,actor_id,event_type,details)
   values(s.club_id,auth.uid(),'correct_round',
   jsonb_build_object('fixture',p_fixture,'reason',trim(p_reason),'players',v_count));
 return jsonb_build_object('corrected',true,'round',f.round_number,'players_updated',v_count,
                           'team_count',v_after->'team_count');
end; $$;

revoke all on function private.fantasy_calculate_fixture(uuid,jsonb),
  private.fantasy_persist_fixture_preview(uuid,jsonb,boolean) from public,anon,authenticated;
revoke all on function public.fantasy_preview_fixture(uuid,jsonb),
  public.fantasy_correct_fixture(uuid,jsonb,text) from public,anon;
grant execute on function public.fantasy_preview_fixture(uuid,jsonb),
  public.fantasy_correct_fixture(uuid,jsonb,text) to authenticated;
commit;