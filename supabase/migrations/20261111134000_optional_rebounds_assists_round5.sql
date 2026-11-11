-- Optional informative box-score data. PIR / Fantasy / broker calculations
-- continue to rely on VAL and existing vote/result bonuses only.
alter table public.game_stats
  add column if not exists rebounds_recorded boolean not null default false,
  add column if not exists assists_recorded boolean not null default false;
alter table public.fixtures
  add column if not exists supplemental_stats_note text;

-- An explicit zero from a CSV is different from an omitted/unknown REB or AST.
-- Keep the original validated admin workflow and don't recalculate finalized rounds.
CREATE OR REPLACE FUNCTION public.fantasy_save_stats(p_fixture uuid, p_rows jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare f public.fixtures%rowtype; v_club uuid; v_count int; row jsonb; v_pid uuid;
  v_pir numeric; v_minutes numeric; v_played boolean;
begin
 select * into f from public.fixtures where id=p_fixture for update;
 if not found then raise exception 'Partido non atopado'; end if;
 select club_id into v_club from public.seasons where id=f.season_id;
 if not private.is_admin(v_club) then raise exception 'Só administración'; end if;
 if f.ended_at is null or f.status='finalized' then
  raise exception 'Indica primeiro a hora de final e non alteres xornadas publicadas'; end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)<1 or jsonb_array_length(p_rows)>40
 then raise exception 'Importación incorrecta'; end if;
 v_count:=0;
 for row in select value from jsonb_array_elements(p_rows)
 loop
  v_pid:=(row->>'player_id')::uuid;
  if not exists(select 1 from public.players where id=v_pid and club_id=v_club)
  then raise exception 'O rexistro contén un xogador doutro club ou inexistente'; end if;
  v_played:=coalesce((row->>'played')::boolean,false);
  v_minutes:=coalesce((row->>'minutes')::numeric,0);
  v_pir:=(row->>'pir')::numeric;
  if v_minutes<0 or v_minutes>60 or v_pir is null or v_pir not between -100 and 100
   then raise exception 'Minutos/PIR incorrectos; revisa a importación'; end if;
  if v_played=false and (v_minutes>0 or v_pir<>0) then
    raise exception 'Xogador sen minutos cunha valoración non nula'; end if;
  if ((row->>'rebounds_recorded')::boolean is true and
      ((row->>'rebounds') is null or (row->>'rebounds')::integer not between 0 and 100))
     or ((row->>'assists_recorded')::boolean is true and
      ((row->>'assists') is null or (row->>'assists')::integer not between 0 and 100))
  then raise exception 'REB / AST deben ser números enteiros entre 0 e 100'; end if;
  insert into public.game_stats(fixture_id,player_id,minutes,points,rebounds,assists,
    steals,blocks,turnovers,pir,played,source_format,rebounds_recorded,assists_recorded)
  values(p_fixture,v_pid,v_minutes,coalesce((row->>'points')::int,0),
    coalesce((row->>'rebounds')::int,0),coalesce((row->>'assists')::int,0),
    coalesce((row->>'steals')::int,0),coalesce((row->>'blocks')::int,0),
    coalesce((row->>'turnovers')::int,0),v_pir,v_played,
    coalesce(nullif(row->>'source_format',''),'manual'),
    coalesce((row->>'rebounds_recorded')::boolean,false),
    coalesce((row->>'assists_recorded')::boolean,false))
  on conflict(fixture_id,player_id) do update set
    minutes=excluded.minutes,points=excluded.points,rebounds=excluded.rebounds,
    assists=excluded.assists,
    rebounds_recorded=excluded.rebounds_recorded,
    assists_recorded=excluded.assists_recorded,steals=excluded.steals,blocks=excluded.blocks,
    turnovers=excluded.turnovers,pir=excluded.pir,played=excluded.played,
    source_format=excluded.source_format,revised_at=now();
  v_count:=v_count+1;
 end loop;
 update public.fixtures set stats_finalized_at=now(),status='awaiting_votes' where id=p_fixture;
 insert into public.fantasy_audit(club_id,actor_id,event_type,details)
 values(v_club,auth.uid(),'import_stats',jsonb_build_object('fixture',p_fixture,'rows',v_count));
 return v_count;
end; $function$;

CREATE OR REPLACE FUNCTION public.fantasy_correct_fixture(p_fixture uuid, p_rows jsonb, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
     where t.season_id=s.id and tr.round_number>f.round_number)
   or exists(select 1 from public.fantasy_teams t
     where t.season_id=s.id and t.created_at>coalesce(f.votes_finalized_at,f.ended_at)) then
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
      rebounds_recorded=coalesce((v_row->>'rebounds_recorded')::boolean,rebounds_recorded),
      assists_recorded=coalesce((v_row->>'assists_recorded')::boolean,assists_recorded),
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
end; $function$;

-- Partial X5 footage, stopped after Yoel's injury. Match exactly by registered
-- Fantasy names, except the user-confirmed Dunkos = Adán alias. The separate
-- source row "Pola" (#30, REB=3, AST=0) is NOT assigned to anyone without proof.
do $x5$
declare
 v_fixture uuid;
 v_count integer;
begin
 select id into strict v_fixture
 from public.fixtures where round_number=5 and status='finalized';
 if (select count(*) from public.game_stats where fixture_id=v_fixture)<>18 then
   raise exception 'Expected 18 published game_stats rows in X5';
 end if;
 with observed(name,reb,ast) as (
   values
    ('Brais',0,1),
    ('Iván',1,0),
    ('Juan',10,1),
    ('Yoel',1,2),
    ('Mario',6,1),
    ('Adán',0,0),
    ('Luca',1,2),
    ('Álex',1,0),
    ('Álvaro',2,3),
    ('Diego',0,1),
    ('Adri',9,2)
 )
 update public.game_stats g set
  rebounds=o.reb,assists=o.ast,
  rebounds_recorded=true,assists_recorded=true,
  revised_at=now()
 from observed o join public.players p on p.name=o.name
 where g.fixture_id=v_fixture and g.player_id=p.id
 and g.rebounds_recorded=false and g.assists_recorded=false
 and g.rebounds=0 and g.assists=0;
 get diagnostics v_count=row_count;
 if v_count<>11 then
   raise exception 'Expected 11 exact player matches for X5, updated %',v_count;
 end if;
 update public.fixtures set
 supplemental_stats_note=
 'REB/AST parciais: rexistro dun vídeo interrompido. 31 rebotes e 13 asistencias vinculados a 11 xogadores. Fila «Pola» (#30: 3 rebotes, 0 asistencias) pendente de identificar; NON asignada a Edu nin a outro xogador.'
 where id=v_fixture;
 if (select count(*) from public.game_stats where fixture_id=v_fixture
   and rebounds_recorded and assists_recorded)<>11
  or (select sum(rebounds) from public.game_stats where fixture_id=v_fixture and rebounds_recorded)<>31
  or (select sum(assists) from public.game_stats where fixture_id=v_fixture and assists_recorded)<>13
 then raise exception 'Supplemental totals from partial video do not match'; end if;
end;$x5$;
