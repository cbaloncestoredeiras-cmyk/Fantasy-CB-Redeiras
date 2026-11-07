import {escapeHtml as h} from './logic.js';

// The administrator's saved callups are already readable by club members via RLS.
// A saved list contains at least three people, enforced by fantasy_set_callups.
// An empty list means NOT YET PUBLISHED, not that nobody is called up.
export function callupInfo(data,fixture,playerId){
 if(!fixture?.id)return {state:'pending',round:null,count:0};
 const saved=(data?.callups||[]).filter(row=>row.fixture_id===fixture.id);
 const round=Number(fixture.round_number)||null;
 if(saved.length<3)return {state:'pending',round,count:0};
 return {state:saved.some(row=>row.player_id===playerId)?'called':'out',round,count:saved.length};
}
const label=state=>state==='called'?'Convocado':state==='out'?'Non convocado':'Convocatoria pendente';

export function callupBadge(data,fixture,playerId){
 const info=callupInfo(data,fixture,playerId);
 const detail=info.round?'X'+info.round+' · ':'';
 return '<span class="callup-badge '+info.state+'" aria-label="'+h(detail+label(info.state))+'">'+h(label(info.state))+'</span>';
}
export function callupDetail(data,fixture,playerId){
 const info=callupInfo(data,fixture,playerId);
 const prefix=info.round?'Xornada '+info.round+' · ':'Próxima xornada · ';
 const message=info.state==='called'
  ?'Figura na convocatoria oficial do club. Estar convocado non garante minutos nin puntos Fantasy.'
  :info.state==='out'
   ?'Non figura na convocatoria gardada para esta xornada. Podes fichalo, pero revisa este dato antes de confirmar o quinteto; a convocatoria pode cambiar.'
   :'O club aínda non gardou a convocatoria para esta xornada. Non se pode confirmar quen xogará.';
 return '<div class="callup-detail '+info.state+'" role="status"><strong>'+h(prefix+label(info.state))+'</strong><p>'+h(message)+'</p></div>';
}
export function callupSummary(data,fixture){
 const info=callupInfo(data,fixture,null);
 const x=info.round?'X'+info.round:'a próxima xornada';
 const lead=info.state==='pending'?'Convocatoria '+x+' pendente de publicación':
  'Convocatoria '+x+' dispoñible · '+info.count+' xogadores';
 return '<div class="callup-summary"><div><b>'+h(lead)+'</b><p>'+
 (info.state==='pending'?'Aínda non se sabe quen está convocado.':'Consulta en cada xogador se está convocado antes de fichar.')+
 '</p></div><button type="button" class="btn small secondary" data-action="refresh-callups">Actualizar convocatoria</button></div>';
}
