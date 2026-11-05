import {pts,escapeHtml as h,euro} from './logic.js';
import {simulatedLineup,idealQuintet} from './strategy.js';

export function simulatorPanel(data,draft,round,open){
 const s=simulatedLineup(data,draft,round);
 const lookup=id=>data.playerMap[id]?.name||'Xogador';
 const list=(ids,cls,emptyLabel)=>ids.length?ids.map(id=>'<span class="simulation-token '+cls+'">'+h(lookup(id))+'</span>').join(''):'<span class="mini muted">'+emptyLabel+'</span>';
 const balance=s.cashAfter>=0?euro(s.cashAfter):'−'+euro(-s.cashAfter);
 let status=s.valid?'Quinteto válido para as regras e o orzamento.':'Simulación incompleta ou non válida. Revisa posicións, orzamento e cambios.';
 if(!open)status+=' Mercado pechado: non se poden confirmar fichaxes agora.';
 const oldEstimate=s.oldEstimate,newEstimate=s.newEstimate;
 const forecast=oldEstimate!==null&&newEstimate!==null
  ?'<p class="mini">Media recente do quinteto anterior: <b>'+pts(oldEstimate)+' pts</b>. Media dos xogadores seleccionados: <b>'+pts(newEstimate)+' pts</b>. Diferenza orientativa: <b>'+(newEstimate-oldEstimate>=0?'+':'')+pts(newEstimate-oldEstimate)+' pts</b>.</p>'
  :newEstimate!==null?'<p class="mini">Media recente do quinteto simulado: <b>'+pts(newEstimate)+' pts</b>.</p>'
  :'<p class="mini muted">Sen puntuacións publicadas suficientes para comparar a forma dos cinco xogadores.</p>';
 return '<section class="panel simulator-panel" aria-label="Simulador de fichaxes">'+
 '<div class="row"><div><h2>Simulador de fichaxes</h2><p class="mini muted">Calcula o efecto dos cambios antes de confirmalos. Aquí non se garda ningunha operación.</p></div><span class="tag">SIMULACIÓN</span></div>'+
 '<div class="simulator-metrics"><div><span>Efectivo resultante</span><strong>'+balance+'</strong></div>'+
 '<div><span>Cambios simulados</span><strong>'+s.changes+(data.team?' / '+s.max:'')+'</strong></div>'+
 '<div><span>Cambios dispoñibles despois</span><strong>'+(data.team?Math.max(0,s.changesLeft):s.max)+'</strong></div></div>'+
 '<div class="simulator-movements"><div><h3>'+(data.team?'Saen do quinteto':'Quinteto en preparación')+'</h3>'+
 (data.team?list(s.removed,'out','Sen saídas'):list(draft,'in','Selecciona os teus cinco xogadores'))+'</div>'+
 '<div><h3>'+(data.team?'Entran no quinteto':'Custo total')+'</h3>'+
 (data.team?list(s.added,'in','Sen entradas'):'<b>'+euro(s.selection.cost)+'</b>')+'</div></div>'+
 '<div class="simulation-status '+(s.valid?'ok':'warn')+'" role="status">'+h(status)+'</div>'+
 '<div class="simulator-forecast"><h3>Referencia de rendemento</h3>'+forecast+
 '<p class="mini muted">É unha comparación de medias pasadas, non unha predición de puntos nin unha promesa de rendemento.</p></div>'+
 (s.hasDifferences?'<button type="button" class="btn small secondary" data-action="restore-simulation">'+
 (data.team?'Restaurar quinteto actual':'Limpar selección')+'</button>':'')+'</section>';
}

export function idealTeamPanel(data,round,person){
 const fixture=(data.fixtures||[]).find(f=>Number(f.round_number)===Number(round)&&f.status==='finalized');
 if(!fixture)return '<section class="panel ideal-panel"><h2>Equipo ideal</h2><p class="mini muted">Aparecerá cando se publique a primeira xornada Fantasy.</p></section>';
 const ideal=idealQuintet(data,round);
 if(!ideal)return '<section class="panel ideal-panel"><h2>Equipo ideal · X'+Number(round)+'</h2><p class="mini muted">Non se puido formar un quinteto válido cos datos oficiais da xornada.</p></section>';
 const rows=ideal.players.slice().sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name));
 return '<section class="panel ideal-panel"><div class="row"><div><h2>Equipo ideal · X'+Number(round)+'</h2><p class="mini muted">Máis puntos posibles co orzamento e as posicións regulamentarias.</p></div><span class="tag good">PUBLICADO</span></div>'+
 '<div class="ideal-summary"><div><span>Puntos Fantasy</span><strong>'+pts(ideal.points)+'</strong></div>'+
 '<div><span>Custo naquela xornada</span><strong>'+euro(ideal.cost)+'</strong></div>'+
 '<div><span>Orzamento restante</span><strong>'+euro(ideal.budget-ideal.cost)+'</strong></div></div>'+
 '<div class="ideal-players">'+rows.map(p=>'<div class="ideal-player">'+person(p)+
 '<div class="ideal-player-score"><strong>'+pts(p.points)+' pts</strong><small>'+euro(p.price)+'</small></div></div>').join('')+'</div>'+
 '<p class="mini muted">Os prezos corresponden ao inicio da xornada X'+Number(round)+'. Respéctanse 5 xogadores, mínimo 1 BA e 1 AP/P distintos, e o orzamento inicial.</p></section>';
}
