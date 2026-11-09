import {escapeHtml as h,pts} from './logic.js';
import {FIELDS,playerSeasonStats,leaderboardLeaders,seasonRecords,popularityRows} from './analytics.js';
const val=n=>n==null?'—':pts(n);
const statistic=(name,value,detail='')=>'<div class="analytics-kpi"><span>'+h(name)+'</span><strong>'+val(value)+'</strong>'+(detail?'<small>'+h(detail)+'</small>':'')+'</div>';
export function playerAdvancedPanel(data,id){
 const m=playerSeasonStats(data,id);
 if(!m.played)return '<section class="insight-section"><h3>Estatísticas avanzadas</h3><p class="insight-empty">Sen partidos Fantasy publicados deste xogador. Non se amosan valoracións provisionais.</p></section>';
 const keys=[['fantasy_points','Fantasy'],['pir','PIR'],['points','Puntos'],['rebounds','Rebotes'],['assists','Asistencias'],['minutes','Minutos']];
 const blocks=keys.map(([key,label])=>statistic(label,m.averages[key],key==='fantasy_points'?'Media por partido':'Media por partido')).join('');
 const completed=m.games.slice().reverse();
 const rows=completed.map(g=>'<tr><th scope="row">X'+g.round+'</th><td>'+pts(g.fantasy_points)+'</td><td>'+pts(g.pir)+'</td><td>'+pts(g.points)+'</td><td>'+pts(g.rebounds)+'</td><td>'+pts(g.assists)+'</td><td>'+pts(g.minutes)+'</td></tr>').join('');
 return '<section class="insight-section advanced-profile"><h3>Estatísticas avanzadas</h3>'+
 '<div class="analytics-kpis">'+blocks+'</div>'+
 '<p class="mini muted">Partidos disputados: '+m.played+' · Máximo Fantasy: '+pts(m.best)+' · Regularidade (desviación): '+(m.consistency==null?'—':pts(m.consistency))+' puntos.</p>'+
 '<div class="tablewrap"><table class="table analytics-history"><thead><tr><th scope="col">Xornada</th><th scope="col">Fantasy</th><th scope="col">PIR</th><th scope="col">PTS</th><th scope="col">REB</th><th scope="col">AST</th><th scope="col">MIN</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
 '<p class="mini muted">Só inclúe partidos xogados e xornadas oficialmente publicadas.</p></section>';
}
export function courtLineup(data,ids,avatar){
 const selected=ids.map(id=>data.playerMap?.[id]).filter(Boolean);
 if(!selected.length)return '<p class="mini muted">Escolle os xogadores no mercado para ver o quinteto na pista.</p>';
 const base=selected.find(p=>p.positions.includes('BA'))||selected[0];
 const inside=selected.find(p=>p.id!==base.id&&(p.positions.includes('AP')||p.positions.includes('P')))||selected.find(p=>p.id!==base.id)||base;
 const others=selected.filter(p=>p.id!==base.id&&p.id!==inside.id);
 const spots=[{p:base,position:'base',x:50,y:78},{p:inside,position:'interior',x:50,y:25},
  ...others.map((p,i)=>({p,position:'exterior',x:[18,82,50][i],y:[47,47,56][i]}))];
 const valid=ids.length===5;
 return '<div class="court-wrapper"><div class="court-visual" role="group" aria-label="Quinteto distribuído nunha pista de baloncesto">'+
 '<svg viewBox="0 0 620 400" aria-hidden="true" focusable="false" preserveAspectRatio="none" class="court-lines">'+
 '<rect x="7" y="7" width="606" height="386" rx="12"/><path d="M7 200h606"/>'+
 '<circle cx="310" cy="200" r="62"/><path d="M240 7v145h140V7M240 393V248h140v145"/>'+
 '<circle cx="310" cy="106" r="18"/><circle cx="310" cy="294" r="18"/>'+
 '<path d="M165 7a145 145 0 0 0 290 0M165 393a145 145 0 0 1 290 0"/>'+
 '</svg>'+spots.map((s,i)=>'<button type="button" class="court-player" style="--court-x:'+s.x+'%;--court-y:'+s.y+'%" data-player="'+h(s.p.id)+'" aria-label="Abrir perfil de '+h(s.p.name)+'">'+
 avatar(s.p,'court-avatar')+'<strong>'+h(s.p.name)+'</strong><small>'+h(s.p.positions.join(' / '))+'</small></button>').join('')+
 '</div><p class="mini muted">'+(valid?'Representación visual orientativa, sen formación fixa.':'Vista previa: '+selected.length+' de 5 xogadores.')+' Preme un xogador para ver o perfil.</p></div>';
}
export function popularityPanel(data){
 const rows=popularityRows(data);
 if(!rows.length)return '<section class="panel popularity-panel"><h2>Popularidade no mercado</h2><p class="mini muted">As porcentaxes aparecerán cando haxa unha xornada publicada e un mínimo de participantes. Non se mostran quintetos individuais nin escollas antes do peche.</p></section>';
 const last=(data.fixtures||[]).filter(f=>f.status==='finalized').sort((a,b)=>Number(b.round_number)-Number(a.round_number))[0];
 const uncalled=rows.filter(v=>v.called===false);
 return '<section class="panel popularity-panel"><h2>Popularidade do mercado · X'+h(last?.round_number||'')+'</h2>'+
 '<p class="mini muted">Todos os xogadores, incluídos os non convocados. Baseado nos quintetos pechados da última xornada publicada, non nas fichaxes posteriores. Os valores inferiores a tres seleccións agrúpanse para protexer a privacidade.</p>'+
 (uncalled.length?'<p class="mini muted">Non convocados: '+uncalled.length+'. A selección dun non convocado non demostra por si soa un despiste nin unha decisión táctica.</p>':'')+
 '<div class="popularity-list">'+rows.map(v=>'<div class="popularity-item"><div><span>'+h(v.player.name)+'</span>'+
 (v.called===false?' <span class="tag warn">Non convocado</span>':'')+
 '<small>'+(v.pct==null?'Menos de 3 equipos':pts(v.pct)+' % · '+v.picks+' equipos')+'</small></div>'+
 (v.pct==null?'': '<div class="popularity-track" aria-hidden="true"><span style="width:'+Math.max(0,Math.min(100,v.pct))+'%"></span></div>')+'</div>').join('')+'</div></section>';
}
export function analyticsPage(data,sort='fantasy_points',person){
 const stats=leaderboardLeaders(data),field=FIELDS.some(x=>x[0]===sort)?sort:'fantasy_points';
 const sorted=stats.slice().sort((a,b)=>(b.metrics.averages[field]??-9999)-(a.metrics.averages[field]??-9999)||a.player.name.localeCompare(b.player.name));
 const options=FIELDS.map(([key,label])=>'<option value="'+key+'"'+(field===key?' selected':'')+'>'+h(label)+'</option>').join('');
 const html=sorted.length?'<div class="analytics-ranking">'+sorted.map((r,i)=>
  '<div class="analytics-player"><span class="analytics-place">'+(i+1)+'</span>'+person(r.player)+
  '<div class="analytics-right"><strong>'+pts(r.metrics.averages[field])+'</strong><small>media · '+r.metrics.played+' partidos</small></div>'+
  '<button type="button" class="btn small secondary" data-player="'+h(r.player.id)+'">Perfil</button></div>').join('')+'</div>':
  '<div class="insight-empty">Aínda non hai estatísticas Fantasy publicadas. Este panel actualizarase coa primeira xornada.</div>';
 return '<section class="panel analytics-page"><div class="row"><div><h2>Estatísticas avanzadas</h2><p class="mini muted">Clasificación por medias e só por partidos disputados.</p></div>'+
 '<div class="field"><label for="analytics-sort">Ordenar por</label><select id="analytics-sort">'+options+'</select></div></div>'+html+'</section>';
}
export function recordsPanel(data){
 const r=seasonRecords(data);
 if(!r.completed)return '<section class="panel records-panel"><h2>Logros e récords</h2><div class="insight-empty">Aínda non hai xornadas publicadas. Os récords e os logros activaranse automaticamente cos resultados reais.</div></section>';
 const cards=[
 ['Mellor xornada Fantasy',r.bestRound?pts(r.bestRound.round_points)+' puntos':'—',r.bestRound?'X'+r.bestRound.round_number+' · '+r.bestRound.team_name:'Aínda sen puntuación'],
 ['Récord individual',r.topPlayer?pts(r.topPlayer.metrics.best)+' puntos':'—',r.topPlayer?.player.name||'Sen datos'],
 ['Máis xornadas gañadas',r.mostWins?r.mostWins.wins+' xornadas':'—',r.mostWins?.name||'Sen resultados'],
 ['Maior remontada',r.comeback?'+'+r.comeback.places+' posicións':'—',r.comeback?r.comeback.teamName+' · X'+r.comeback.round:'Cómpre máis dunha xornada']
 ];
 return '<section class="panel records-panel"><h2>Logros e récords</h2><p class="mini muted">Recoñecementos automáticos baseados só en resultados oficiais xa publicados.</p>'+
 '<div class="records-grid">'+cards.map(([title,value,label])=>'<div class="record-card"><span>'+h(title)+'</span><strong>'+h(value)+'</strong><small>'+h(label)+'</small></div>').join('')+'</div></section>';
}
