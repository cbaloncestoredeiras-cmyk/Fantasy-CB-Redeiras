-- Informative full basketball box score, from user-supplied partial X5 video.
-- Never mutate PIR, Fantasy points, team scores, price or transfer history.
alter table public.game_stats
  add column if not exists fg_made integer,
  add column if not exists fg_attempted integer,
  add column if not exists two_made integer,
  add column if not exists two_attempted integer,
  add column if not exists three_made integer,
  add column if not exists three_attempted integer,
  add column if not exists ft_made integer,
  add column if not exists ft_attempted integer,
  add column if not exists off_reb integer,
  add column if not exists def_reb integer,
  add column if not exists shots_rejected integer,
  add column if not exists fouls integer,
  add column if not exists fouls_drawn integer,
  add column if not exists eff integer,
  add column if not exists plus_minus integer,
  add column if not exists steals_recorded boolean not null default false,
  add column if not exists blocks_recorded boolean not null default false,
  add column if not exists turnovers_recorded boolean not null default false;
alter table public.game_stats
  add constraint game_stats_fg_made_valid check (fg_made is null or fg_made between 0 and 100),
  add constraint game_stats_fg_attempted_valid check (fg_attempted is null or fg_attempted between 0 and 100),
  add constraint game_stats_two_made_valid check (two_made is null or two_made between 0 and 100),
  add constraint game_stats_two_attempted_valid check (two_attempted is null or two_attempted between 0 and 100),
  add constraint game_stats_three_made_valid check (three_made is null or three_made between 0 and 100),
  add constraint game_stats_three_attempted_valid check (three_attempted is null or three_attempted between 0 and 100),
  add constraint game_stats_ft_made_valid check (ft_made is null or ft_made between 0 and 100),
  add constraint game_stats_ft_attempted_valid check (ft_attempted is null or ft_attempted between 0 and 100),
  add constraint game_stats_off_reb_valid check (off_reb is null or off_reb between 0 and 100),
  add constraint game_stats_def_reb_valid check (def_reb is null or def_reb between 0 and 100),
  add constraint game_stats_shots_rejected_valid check (shots_rejected is null or shots_rejected between 0 and 100),
  add constraint game_stats_fouls_valid check (fouls is null or fouls between 0 and 100),
  add constraint game_stats_fouls_drawn_valid check (fouls_drawn is null or fouls_drawn between 0 and 100),
  add constraint game_stats_eff_valid check (eff is null or eff between -200 and 200),
  add constraint game_stats_plus_minus_valid check (plus_minus is null or plus_minus between -200 and 200);
-- All optional metrics are NULL when unavailable, including unknown FGM.
-- STL / BLK / TOV are older non-null columns; explicit flags distinguish unknown from 0.
create or replace function public.fantasy_save_boxscore(
 p_fixture uuid,p_rows jsonb,p_note text default null)
returns integer language plpgsql security definer set search_path=''
as $fn$
declare
 f public.fixtures%rowtype;v_club uuid;v_r jsonb;v_pid uuid;
 v_count integer:=0;v_value integer;v_any boolean;
begin
 select * into f from public.fixtures where id=p_fixture for update;
 if not found then raise exception 'Xornada non atopada';end if;
 select club_id into v_club from public.seasons where id=f.season_id;
 if auth.uid() is null or v_club is null or not private.is_admin(v_club)
 then raise exception 'Só administración' using errcode='42501';end if;
 if f.stats_finalized_at is null then raise exception 'Primeiro garda as valoracións oficiais';end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 40
 then raise exception 'Entre 1 e 40 filas no CSV';end if;
 if (select count(distinct value->>'player_id') from jsonb_array_elements(p_rows))<>jsonb_array_length(p_rows)
 then raise exception 'Xogadores duplicados';end if;
 if length(coalesce(p_note,''))>500 then raise exception 'Nota demasiado longa';end if;
 for v_r in select value from jsonb_array_elements(p_rows)
 loop
   v_pid:=(v_r->>'player_id')::uuid;
   if not exists (select 1 from public.players p where p.id=v_pid and p.club_id=v_club)
   then raise exception 'Xogador non recoñecido';end if;
   v_any:=false;
   if v_r->>'fg_made' is not null then
     if not (v_r->>'fg_made') ~ '^-?[0-9]+$' then raise exception 'Dato fg_made non enteiro';end if;
     v_value:=(v_r->>'fg_made')::integer;
     if v_value not between 0 and 100
     then raise exception 'Dato fg_made fóra de rango';end if;
     v_any:=true;
   end if;
   if v_r->>'fg_attempted' is not null then
     if not (v_r->>'fg_attempted') ~ '^-?[0-9]+$' then raise exception 'Dato fg_attempted non enteiro';end if;
     v_value:=(v_r->>'fg_attempted')::integer;
     if v_value not between 0 and 100
     then raise exception 'Dato fg_attempted fóra de rango';end if;
     v_any:=true;
   end if;
   if v_r->>'two_made' is not null then
     if not (v_r->>'two_made') ~ '^-?[0-9]+$' then raise exception 'Dato two_made non enteiro';end if;
     v_value:=(v_r->>'two_made')::integer;
     if v_value not between 0 and 100
     then raise exception 'Dato two_made fóra de rango';end if;
     v_any:=true;
   end if;
   if v_r->>'two_attempted' is not null then
     if not (v_r->>'two_attempted') ~ '^-?[0-9]+$' then raise exception 'Dato two_attempted non enteiro';end if;
     v_value:=(v_r->>'two_attempted')::integer;
     if v_value not between 0 and 100
     then raise exception 'Dato two_attempted fóra de rango';end if;
     v_any:=true;
   end if;
   if v_r->>'three_made' is not null then
     if not (v_r->>'three_made') ~ '^-?[0-9]+$' then raise exception 'Dato three_made non enteiro';end if;
     v_value:=(v_r->>'three_made')::integer;
     if v_value not between 0 and 100
     then raise exception 'Dato three_made fóra de rango';end if;
     v_any:=true;
   end if;
   if v_r->>'three_attempted' is not null then
     if not (v_r->>'three_attempted') ~ '^-?[0-9]+$' then raise exception 'Dato three_attempted non enteiro';end if;
     v_value:=(v_r->>'three_attempted')::integer;
     if v_value not between 0 and 100
     then raise exception 'Dato three_attempted fóra de rango';end if;
     v_any:=true;
   end if;
   if v_r->>'ft_made' is not null then
     if not (v_r->>'ft_made') ~ '^-?[0-9]+$' then raise exception 'Dato ft_made non enteiro';end if;
     v_value:=(v_r->>'ft_made')::integer;
     if v_value not between 0 and 100
     then raise exception 'Dato ft_made fóra de rango';end if;
     v_any:=true;
   end if;
   if v_r->>'ft_attempted' is not null then
     if not (v_r->>'ft_attempted') ~ '^-?[0-9]+$' then raise exception 'Dato ft_attempted non enteiro';end if;
     v_value:=(v_r->>'ft_attempted')::integer;
     if v_value not between 0 and 100
     then raise exception 'Dato ft_attempted fóra de rango';end if;
     v_any:=true;
   end if;
   if v_r->>'off_reb' is not null then
     if not (v_r->>'off_reb') ~ '^-?[0-9]+$' then raise exception 'Dato off_reb non enteiro';end if;
     v_value:=(v_r->>'off_reb')::integer;
     if v_value not between 0 and 100
     then raise exception 'Dato off_reb fóra de rango';end if;
     v_any:=true;
   end if;
   if v_r->>'def_reb' is not null then
     if not (v_r->>'def_reb') ~ '^-?[0-9]+$' then raise exception 'Dato def_reb non enteiro';end if;
     v_value:=(v_r->>'def_reb')::integer;
     if v_value not between 0 and 100
     then raise exception 'Dato def_reb fóra de rango';end if;
     v_any:=true;
   end if;
   if v_r->>'shots_rejected' is not null then
     if not (v_r->>'shots_rejected') ~ '^-?[0-9]+$' then raise exception 'Dato shots_rejected non enteiro';end if;
     v_value:=(v_r->>'shots_rejected')::integer;
     if v_value not between 0 and 100
     then raise exception 'Dato shots_rejected fóra de rango';end if;
     v_any:=true;
   end if;
   if v_r->>'fouls' is not null then
     if not (v_r->>'fouls') ~ '^-?[0-9]+$' then raise exception 'Dato fouls non enteiro';end if;
     v_value:=(v_r->>'fouls')::integer;
     if v_value not between 0 and 100
     then raise exception 'Dato fouls fóra de rango';end if;
     v_any:=true;
   end if;
   if v_r->>'fouls_drawn' is not null then
     if not (v_r->>'fouls_drawn') ~ '^-?[0-9]+$' then raise exception 'Dato fouls_drawn non enteiro';end if;
     v_value:=(v_r->>'fouls_drawn')::integer;
     if v_value not between 0 and 100
     then raise exception 'Dato fouls_drawn fóra de rango';end if;
     v_any:=true;
   end if;
   if v_r->>'eff' is not null then
     if not (v_r->>'eff') ~ '^-?[0-9]+$' then raise exception 'Dato eff non enteiro';end if;
     v_value:=(v_r->>'eff')::integer;
     if v_value not between -200 and 200
     then raise exception 'Dato eff fóra de rango';end if;
     v_any:=true;
   end if;
   if v_r->>'plus_minus' is not null then
     if not (v_r->>'plus_minus') ~ '^-?[0-9]+$' then raise exception 'Dato plus_minus non enteiro';end if;
     v_value:=(v_r->>'plus_minus')::integer;
     if v_value not between -200 and 200
     then raise exception 'Dato plus_minus fóra de rango';end if;
     v_any:=true;
   end if;
   if v_r->>'steals' is not null then
     if not (v_r->>'steals') ~ '^-?[0-9]+$' then raise exception 'Dato steals non enteiro';end if;
     v_value:=(v_r->>'steals')::integer;
     if v_value not between 0 and 100
     then raise exception 'Dato steals fóra de rango';end if;
     v_any:=true;
   end if;
   if v_r->>'blocks' is not null then
     if not (v_r->>'blocks') ~ '^-?[0-9]+$' then raise exception 'Dato blocks non enteiro';end if;
     v_value:=(v_r->>'blocks')::integer;
     if v_value not between 0 and 100
     then raise exception 'Dato blocks fóra de rango';end if;
     v_any:=true;
   end if;
   if v_r->>'turnovers' is not null then
     if not (v_r->>'turnovers') ~ '^-?[0-9]+$' then raise exception 'Dato turnovers non enteiro';end if;
     v_value:=(v_r->>'turnovers')::integer;
     if v_value not between 0 and 100
     then raise exception 'Dato turnovers fóra de rango';end if;
     v_any:=true;
   end if;
   if v_r->>'rebounds' is not null then
     if not (v_r->>'rebounds') ~ '^-?[0-9]+$' then raise exception 'Dato rebounds non enteiro';end if;
     v_value:=(v_r->>'rebounds')::integer;
     if v_value not between 0 and 100
     then raise exception 'Dato rebounds fóra de rango';end if;
     v_any:=true;
   end if;
   if v_r->>'assists' is not null then
     if not (v_r->>'assists') ~ '^-?[0-9]+$' then raise exception 'Dato assists non enteiro';end if;
     v_value:=(v_r->>'assists')::integer;
     if v_value not between 0 and 100
     then raise exception 'Dato assists fóra de rango';end if;
     v_any:=true;
   end if;
   if not v_any then continue;end if;
   if v_r->>'fg_made' is not null and v_r->>'fg_attempted' is not null and
       (v_r->>'fg_made')::integer>(v_r->>'fg_attempted')::integer then
       raise exception 'FGM maior que FGA';end if;
   if v_r->>'two_made' is not null and v_r->>'two_attempted' is not null and
       (v_r->>'two_made')::integer>(v_r->>'two_attempted')::integer then
       raise exception '2PM maior que 2PA';end if;
   if v_r->>'three_made' is not null and v_r->>'three_attempted' is not null and
       (v_r->>'three_made')::integer>(v_r->>'three_attempted')::integer then
       raise exception '3PM maior que 3PA';end if;
   if v_r->>'ft_made' is not null and v_r->>'ft_attempted' is not null and
       (v_r->>'ft_made')::integer>(v_r->>'ft_attempted')::integer then
       raise exception 'FTM maior que FTA';end if;
   if v_r->>'fg_made' is not null and v_r->>'two_made' is not null and
       v_r->>'three_made' is not null and
       (v_r->>'fg_made')::integer<>(v_r->>'two_made')::integer+(v_r->>'three_made')::integer
       then raise exception 'FGM distinto de 2PM + 3PM';end if;
   if v_r->>'fg_attempted' is not null and v_r->>'two_attempted' is not null and
       v_r->>'three_attempted' is not null and
       (v_r->>'fg_attempted')::integer<>(v_r->>'two_attempted')::integer+(v_r->>'three_attempted')::integer
       then raise exception 'FGA distinto de 2PA + 3PA';end if;
   if v_r->>'rebounds' is not null and v_r->>'off_reb' is not null and v_r->>'def_reb' is not null and
       (v_r->>'rebounds')::integer<>(v_r->>'off_reb')::integer+(v_r->>'def_reb')::integer
       then raise exception 'REB distinto de OREB + DREB';end if;
   update public.game_stats g set
    fg_made=case when v_r->>'fg_made' is not null then (v_r->>'fg_made')::integer else g.fg_made end,
    fg_attempted=case when v_r->>'fg_attempted' is not null then (v_r->>'fg_attempted')::integer else g.fg_attempted end,
    two_made=case when v_r->>'two_made' is not null then (v_r->>'two_made')::integer else g.two_made end,
    two_attempted=case when v_r->>'two_attempted' is not null then (v_r->>'two_attempted')::integer else g.two_attempted end,
    three_made=case when v_r->>'three_made' is not null then (v_r->>'three_made')::integer else g.three_made end,
    three_attempted=case when v_r->>'three_attempted' is not null then (v_r->>'three_attempted')::integer else g.three_attempted end,
    ft_made=case when v_r->>'ft_made' is not null then (v_r->>'ft_made')::integer else g.ft_made end,
    ft_attempted=case when v_r->>'ft_attempted' is not null then (v_r->>'ft_attempted')::integer else g.ft_attempted end,
    off_reb=case when v_r->>'off_reb' is not null then (v_r->>'off_reb')::integer else g.off_reb end,
    def_reb=case when v_r->>'def_reb' is not null then (v_r->>'def_reb')::integer else g.def_reb end,
    shots_rejected=case when v_r->>'shots_rejected' is not null then (v_r->>'shots_rejected')::integer else g.shots_rejected end,
    fouls=case when v_r->>'fouls' is not null then (v_r->>'fouls')::integer else g.fouls end,
    fouls_drawn=case when v_r->>'fouls_drawn' is not null then (v_r->>'fouls_drawn')::integer else g.fouls_drawn end,
    eff=case when v_r->>'eff' is not null then (v_r->>'eff')::integer else g.eff end,
    plus_minus=case when v_r->>'plus_minus' is not null then (v_r->>'plus_minus')::integer else g.plus_minus end,
    steals=case when v_r->>'steals' is not null then (v_r->>'steals')::integer else g.steals end,
    blocks=case when v_r->>'blocks' is not null then (v_r->>'blocks')::integer else g.blocks end,
    turnovers=case when v_r->>'turnovers' is not null then (v_r->>'turnovers')::integer else g.turnovers end,
    rebounds=case when v_r->>'rebounds' is not null then (v_r->>'rebounds')::integer else g.rebounds end,
    assists=case when v_r->>'assists' is not null then (v_r->>'assists')::integer else g.assists end,
    steals_recorded=(g.steals_recorded or v_r->>'steals' is not null),
    blocks_recorded=(g.blocks_recorded or v_r->>'blocks' is not null),
    turnovers_recorded=(g.turnovers_recorded or v_r->>'turnovers' is not null),
    rebounds_recorded=(g.rebounds_recorded or v_r->>'rebounds' is not null),
    assists_recorded=(g.assists_recorded or v_r->>'assists' is not null),
    revised_at=now()
   where g.fixture_id=p_fixture and g.player_id=v_pid;
   if not found then raise exception 'Non existen valoracións oficiais para ese xogador';end if;
   v_count:=v_count+1;
 end loop;
 if v_count=0 then raise exception 'Non hai datos informativos para gardar';end if;
 if nullif(trim(coalesce(p_note,'')),'') is not null then
  update public.fixtures set supplemental_stats_note=trim(p_note) where id=p_fixture;
 end if;
 insert into public.fantasy_audit(club_id,actor_id,event_type,details)
 values(v_club,auth.uid(),'import_full_boxscore',
 jsonb_build_object('fixture',p_fixture,'players',v_count,'note',nullif(trim(coalesce(p_note,'')),'') is not null));
 return v_count;
end;$fn$;
revoke all on function public.fantasy_save_boxscore(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.fantasy_save_boxscore(uuid,jsonb,text) to authenticated;
-- J5: FEGABA corrections already published; only load the informative fields.
-- Adán +2 FTM and Juan +2 FTM; Adri +2 2PM. All unobserved misses unchanged.
-- Committed fouls use previous official PF corrections; video PF is partial.
do $seed$
declare v_fix uuid; v_count integer;
begin
 select id into strict v_fix from public.fixtures where round_number=5 and status='finalized';
 if (select count(*) from public.game_stats where fixture_id=v_fix)<>18 then
 raise exception 'J5: expected exactly 18 scored player rows';end if;
 with source(name,fg_made,fg_attempted,two_made,two_attempted,three_made,three_attempted,ft_made,ft_attempted,off_reb,def_reb,shots_rejected,fouls,fouls_drawn,eff,plus_minus,steals,blocks,turnovers,rebounds,assists) as (
 values
   ('Brais',0,4,0,2,0,2,0,0,0,0,1,1,0,-2,-1,0,1,0,0,1),
   ('Iván',0,0,0,0,0,0,0,0,0,1,0,5,0,3,-3,2,0,0,1,0),
   ('Juan',3,7,3,6,0,1,3,5,2,8,1,3,1,10,-11,5,0,7,10,1),
   ('Yoel',1,8,0,4,1,4,1,2,0,1,0,3,1,0,-8,2,0,1,1,2),
   ('Mario',2,11,2,10,0,1,0,0,3,3,0,3,0,5,-18,4,0,1,6,1),
   ('Adán',1,3,0,2,1,1,4,4,0,0,1,2,1,3,-4,0,0,0,0,0),
   ('Luca',1,3,1,2,0,1,0,0,1,0,0,3,0,2,1,0,0,1,1,2),
   ('Álex',0,1,0,1,0,0,0,0,0,1,0,2,0,0,-5,0,0,0,1,0),
   ('Álvaro',1,3,1,2,0,1,2,4,0,2,0,2,1,4,-12,0,0,1,2,3),
   ('Edu',1,10,1,7,0,3,0,0,0,3,0,5,0,-1,-13,2,1,0,3,0),
   ('Diego',1,5,0,1,1,4,1,2,0,0,0,2,0,0,-5,0,0,0,0,1),
   ('Adri',2,8,2,8,0,0,2,4,4,5,0,3,0,9,-6,2,2,0,9,2)
 )
 update public.game_stats g set
    fg_made=s.fg_made,
    fg_attempted=s.fg_attempted,
    two_made=s.two_made,
    two_attempted=s.two_attempted,
    three_made=s.three_made,
    three_attempted=s.three_attempted,
    ft_made=s.ft_made,
    ft_attempted=s.ft_attempted,
    off_reb=s.off_reb,
    def_reb=s.def_reb,
    shots_rejected=s.shots_rejected,
    fouls=s.fouls,
    fouls_drawn=s.fouls_drawn,
    eff=s.eff,
    plus_minus=s.plus_minus,
    steals=s.steals,
    blocks=s.blocks,
    turnovers=s.turnovers,
    rebounds=s.rebounds,
    assists=s.assists,
    steals_recorded=true,
    blocks_recorded=true,
    turnovers_recorded=true,
    rebounds_recorded=true,
    assists_recorded=true,
    revised_at=now()
 from source s join public.players p on p.name=s.name
 where g.fixture_id=v_fix and g.player_id=p.id and g.fg_made is null;
 get diagnostics v_count=row_count;
 if v_count not in (0,12) then raise exception 'J5 data import expected 12 or 0 rows, got %',v_count;end if;
 update public.fixtures set supplemental_stats_note=
 'Boxscore parcial J5 ata lesión de Yoel. REB, AST, STL, TOV, BLK, SR, tiros, EFF e +/- proceden do vídeo; puntos, minutos, VAL e faltas revisados con FEGABA. Axustes de acertos: Juan +2 TL, Adán +2 TL, Adri +2 tiros de 2. Non se engadiron fallos non observados. Estatísticas parciais, sen impacto en Fantasy.'
 where id=v_fix;
end;$seed$;
