import {BOX_FIELDS,BOX_PCT,recorded,boxPercentage} from './boxscore.js';
import {escapeHtml as h,pts} from './logic.js';
import {FIELDS,playerSeasonStats,leaderboardLeaders,seasonRecords,popularityRows} from './analytics.js';
const val=n=>n==null?'—':pts(n);
const statistic=(name,value,detail='')=>'<div class="analytics-kpi"><span>'+h(name)+'</span><strong>'+val(value)+'</strong>'+(detail?'<small>'+h(detail)+'</small>':'')+'</div>';
export function playerAdvancedPanel(data,id){
 const m=playerSeasonStats(data,id);
 if(!m.played)return '<section class="insight-section"><h3>Estatísticas avanzadas</h3><p class="insight-empty">Sen partidos Fantasy publicados deste xogador. Non se amosan valoracións provisionais.</p></section>';
 const keys=[['fantasy_points','Fantasy'],['pir','PIR'],['points','Puntos'],['rebounds','Rebotes'],['assists','Asistencias'],['minutes','Minutos']];
 const blocks=keys.map(([key,label])=>statistic(label,m.averages[key],
  key==='rebounds'||key==='assists'?'Media de '+m.observedGames[key]+' partido(s) con rexistro':'Media por partido')).join('');
 const completed=m.games.slice().reverse();
 const fixtureNotes=new Map((data.fixtures||[]).filter(f=>f.supplemental_stats_note).map(f=>[f.id,f.supplemental_stats_note]));
 const rows=completed.map(g=>'<tr><th scope="row">X'+g.round+
 (fixtureNotes.has(g.fixture_id)?' <span class="tag warn" title="REB/AST parciais">parcial</span>':'')+
 '</th><td>'+pts(g.fantasy_points)+'</td><td>'+pts(g.pir)+'</td><td>'+pts(g.points)+'</td>'+
 '<td>'+(g.rebounds_recorded===true?pts(g.rebounds):'—')+'</td>'+
 '<td>'+(g.assists_recorded===true?pts(g.assists):'—')+'</td>'+
 '<td>'+pts(g.minutes)+'</td></tr>').join('');
 const notes=[...new Set(completed.map(g=>fixtureNotes.get(g.fixture_id)).filter(Boolean))];
 const fmt=(g,key)=>recorded(g,key)?pts(g[key]):'—';
 const attempts=(g,m,a)=>recorded(g,m)&&recorded(g,a)?pts(g[m])+' / '+pts(g[a]):'—';
 const percent=(g,m,a)=>{const n=boxPercentage(g[m],g[a]);return n===null?'—':pts(n)+' %';};
 const shots=completed.map(g=>'<tr><th scope="row">X'+g.round+'</th>'+
 '<td>'+attempts(g,'fg_made','fg_attempted')+'</td>'+
 '<td>'+percent(g,'fg_made','fg_attempted')+'</td>'+
 '<td>'+attempts(g,'two_made','two_attempted')+'</td>'+
 '<td>'+percent(g,'two_made','two_attempted')+'</td>'+
 '<td>'+attempts(g,'three_made','three_attempted')+'</td>'+
 '<td>'+percent(g,'three_made','three_attempted')+'</td>'+
 '<td>'+attempts(g,'ft_made','ft_attempted')+'</td>'+
 '<td>'+percent(g,'ft_made','ft_attempted')+'</td>'+
 ['off_reb','def_reb','rebounds','assists','steals','turnovers','blocks','shots_rejected','fouls','fouls_drawn','eff','plus_minus']
 .map(key=>'<td>'+fmt(g,key)+'</td>').join('')+'</tr>').join('');
 const allBox='<details class="boxscore-details"><summary>Boxscore completo por xornada</summary>'+
 '<div class="tablewrap"><table class="table analytics-history"><thead><tr>'+
 ['Xornada','FGM/FGA','FG%','2PM/2PA','2P%','3PM/3PA','3P%','FTM/FTA','FT%','OREB','DREB','REB','AST','STL','TOV','BLK','SR','PF','PFD','EFF','+/-']
 .map(k=>'<th scope="col">'+k+'</th>').join('')+'</tr></thead><tbody>'+shots+'</tbody></table></div>'+
 '<p class="mini muted">SR = tapóns recibidos; PFD = faltas recibidas; EFF non é VAL/PIR. — indica dato non rexistrado.</p></details>';

 return '<section class="insight-section advanced-profile"><h3>Estatísticas avanzadas</h3>'+
 '<div class="analytics-kpis">'+blocks+'</div>'+
 '<p class="mini muted">Partidos disputados: '+m.played+' · Máximo Fantasy: '+pts(m.best)+' · Regularidade (desviación): '+(m.consistency==null?'—':pts(m.consistency))+' puntos.</p>'+
 '<div class="tablewrap"><table class="table analytics-history"><thead><tr><th scope="col">Xornada</th><th scope="col">Fantasy</th><th scope="col">PIR</th><th scope="col">PTS</th><th scope="col">REB</th><th scope="col">AST</th><th scope="col">MIN</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
 (notes.length?'<div class="notice info" role="note">'+notes.map(n=>h(n)).join(' ')+'</div>':'')+
  allBox+
 '<p class="mini muted">— = dato non rexistrado, non cero. Os datos do boxscore son informativos: non alteran PIR, puntuación Fantasy, prezos nin clasificación. Só se mostran xornadas publicadas.</p></section>';
}
export function courtLineup(data,ids,avatar){
 const selected=ids.map(id=>data.playerMap?.[id]).filter(Boolean);
 if(!selected.length)return '<p class="mini muted">Escolle os xogadores no mercado para ver o quinteto na pista.</p>';
 // FIBA half-court proportions (15 m wide by 14 m deep); single basket at the top.
 // Player positions are illustrative, not a tactical formation.
 const base=selected.find(p=>p.positions.includes('BA'))||selected[0];
 const inside=selected.find(p=>p.id!==base.id&&(p.positions.includes('AP')||p.positions.includes('P')))||selected.find(p=>p.id!==base.id)||base;
 const others=selected.filter(p=>p.id!==base.id&&p.id!==inside.id);
 const spots=[{p:base,x:50,y:86},{p:inside,x:50,y:22},
  ...others.map((p,i)=>({p,x:[23,77,50][i],y:[44,44,59][i]}))];
 const price=id=>data.prices?.[id]==null?'':new Intl.NumberFormat('es-ES',{maximumFractionDigits:2}).format(Number(data.prices[id])/1000000)+' M€';
 const valid=ids.length===5;
 const lastFixture=(data.fixtures||[]).filter(f=>f.status==='finalized').sort((a,b)=>b.round_number-a.round_number)[0];
 const scored=lastFixture?(data.stats||[]).filter(s=>s.fixture_id===lastFixture.id&&s.played===true&&s.fantasy_points!=null&&ids.includes(s.player_id)):[]; 
 const best=scored.length?scored.slice().sort((a,b)=>Number(b.fantasy_points)-Number(a.fantasy_points))[0]?.player_id:null;
 return '<div class="court-wrapper"><div class="court-visual court-half" role="group" aria-label="Media pista de baloncesto: quinteto orientativo e perfís dos xogadores">'+
 '<svg viewBox="0 0 500 467" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet" class="court-lines">'+
 // Perimeter, halfway line and the near half of the centre circle.
 '<rect x="5" y="5" width="490" height="457" rx="3"/>'+
 '<path d="M5 462H495M190 462A60 60 0 0 1 310 462"/>'+
 // Key: FIBA 4.9 m wide, 5.8 m deep, free throw circle diameter 3.6 m.
 '<path d="M168 5V198H332V5"/>'+
 '<path d="M190 198A60 60 0 0 0 310 198"/>'+
 '<path d="M190 198A60 60 0 0 1 310 198" stroke-dasharray="7 8"/>'+
 // The only basket: baseline, backboard, 45 cm rim, restricted-area semicircle.
 '<path class="court-backboard" d="M225 38H275"/>'+
 '<circle class="court-rim" cx="250" cy="53" r="8"/>'+
 '<path d="M208 53A42 42 0 0 0 292 53"/>'+
 // 6.75 m three-point arc; the two straight portions are 0.9 m from sidelines.
 '<path class="court-three-point" d="M30 5V100A225 225 0 0 0 470 100V5"/>'+
 '</svg>'+
 '<span class="court-basket-label" aria-hidden="true">CANASTRA</span>'+
 spots.map(s=>'<button type="button" class="court-player" style="--court-x:'+s.x+'%;--court-y:'+s.y+'%" data-player="'+h(s.p.id)+'" aria-label="Abrir perfil de '+h(s.p.name)+'">'+
 (best===s.p.id?'<span class="court-player-best" title="Maior puntuación entre os teus xogadores na última xornada publicada">MELLOR X'+lastFixture.round_number+'</span>':'')+
 avatar(s.p,'court-avatar')+'<strong>'+h(s.p.name)+'</strong><small>'+h(s.p.positions.join(' / '))+'</small>'+
 (price(s.p.id)?'<span class="court-player-price">'+h(price(s.p.id))+'</span>':'')+'</button>').join('')+
 '</div><p class="mini muted court-caption">'+(valid?'Media pista FIBA a escala orientativa: as posicións dos xogadores son ilustrativas.':'Vista previa: '+selected.length+' de 5 xogadores.')+
 ' Preme calquera xogador para consultar prezo, convocatoria e historial.</p></div>';
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
  '<div class="analytics-right"><strong>'+(r.metrics.averages[field]==null?'—':pts(r.metrics.averages[field])+(field.endsWith('_pct')?' %':''))+'</strong><small>'+r.metrics.observedGames[field]+' partidos con rexistro</small></div>'+
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
