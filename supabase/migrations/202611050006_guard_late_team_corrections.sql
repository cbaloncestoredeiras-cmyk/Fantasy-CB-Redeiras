-- Further protect historical roster cash: late team creation is a financial dependency.
begin;
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
revoke all on function public.fantasy_correct_fixture(uuid,jsonb,text) from public,anon;
grant execute on function public.fantasy_correct_fixture(uuid,jsonb,text) to authenticated;
commit;