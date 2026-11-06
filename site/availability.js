import {escapeHtml as h} from './logic.js';
export function availabilityLabel(p){
 const status=p?.availability_status||'available';
 if(status==='injured')return 'Lesionado'+(Number(p.availability_weeks)>0?' · ~'+Number(p.availability_weeks)+' semanas':'');
 return status==='doubtful'?'Dúbida':'Dispoñible';
}
export function availabilityBadge(p){
 const s=p?.availability_status||'available';
 return s==='available'?'':'<span class="tag availability-badge '+(s==='injured'?'injured':'doubtful')+'" title="Estado comunicado polo club">'+h(availabilityLabel(p))+'</span>';
}
export function unavailablePlayers(ids,players){
 return (ids||[]).map(id=>players?.[id]).filter(p=>p&&['injured','doubtful'].includes(p.availability_status));
}
export function availabilityWarning(ids,players){
 const list=unavailablePlayers(ids,players);
 return list.length?'<div class="notice availability-warning" role="status"><b>Atención:</b> '+list.map(p=>h(p.name)+' ('+h(availabilityLabel(p))+')').join(', ')+'. Segue ocupando unha das cinco prazas; se non xoga non suma puntos Fantasy, e cambialo conta como fichaxe.</div>':'';
}
