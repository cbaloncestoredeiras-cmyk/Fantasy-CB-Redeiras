import {escapeHtml as h,pts} from './logic.js';
import {playerForm,priceSeries,chartPoints} from './insights.js';
const euro=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:2}).format((Number(n)||0)/1e6)+' M€';
const change=s=>s.playedChanges||s.points.length>1?(s.pct>0?'+':'')+pts(s.pct)+' %':'Sen cambios';

export function formBadge(data,id){
 const f=playerForm(id,data.fixtures,data.stats);
 return f.recentCount?'<span class="form-chip" title="Media de puntos Fantasy publicados">Forma '+pts(f.recentAverage)+'</span>':
 '<span class="form-chip no-form" title="Sen partidos Fantasy publicados">Sen datos</span>';
}
export function compareButton(id,selected=[]){
 const active=selected.includes(id);
 return '<button type="button" class="btn small '+(active?'secondary':'outline')+'" data-action="compare-player" data-id="'+h(id)+'" aria-pressed="'+active+'">'+(active?'Seleccionado':'Comparar')+'</button>';
}
export function comparisonPanel(data,selected=[],person){
 const players=selected.map(id=>data.playerMap[id]).filter(Boolean).slice(0,2);
 const cards=players.map(p=>{
  const f=playerForm(p.id,data.fixtures,data.stats),s=priceSeries(p.id,data.history,data.prices[p.id]);
  return '<div class="compare-card"><div class="row">'+person(p)+'<button type="button" class="btn small secondary" data-action="compare-player" data-id="'+h(p.id)+'" aria-label="Retirar '+h(p.name)+' da comparación">Retirar</button></div>'+
   '<dl><div><dt>Prezo</dt><dd>'+euro(data.prices[p.id])+'</dd></div>'+
   '<div><dt>Forma (últimos 3)</dt><dd>'+(f.recentCount?pts(f.recentAverage)+' pts':'Sen datos')+'</dd></div>'+
   '<div><dt>Última puntuación</dt><dd>'+(f.latest?pts(f.latest.points)+' pts · X'+f.latest.round:'Sen datos')+'</dd></div>'+
   '<div><dt>Partidos puntuados</dt><dd>'+f.games+'</dd></div>'+
   '<div><dt>Evolución do prezo</dt><dd>'+change(s)+'</dd></div></dl>'+
   '<button type="button" class="btn small outline" data-player="'+h(p.id)+'">Ver perfil e historial</button></div>';
 }).join('');
 return '<section class="panel compare-panel" id="player-compare"><div class="row"><div><h2>Comparador de xogadores</h2><p class="mini muted">Selecciona dous xogadores no mercado.</p></div>'+
  (players.length?'<button type="button" class="btn small secondary" data-action="clear-compare">Limpar</button>':'')+'</div>'+
  '<div class="compare-grid">'+cards+Array.from({length:2-players.length},()=>'<div class="compare-placeholder">Preme «Comparar» na lista para escoller un xogador.</div>').join('')+'</div>'+
  '<p class="mini muted">A forma é a media de ata tres partidos con puntos Fantasy publicados; nunca se mostran estatísticas provisionais.</p></section>';
}
export function formSection(data,id){
 const f=playerForm(id,data.fixtures,data.stats);
 const trend=f.trend===null?'Tendencia dispoñible tras seis partidos disputados.':f.trend==='up'?'Tendencia á alza.':f.trend==='down'?'Tendencia á baixa.':'Tendencia estable.';
 return '<section class="insight-section"><h3>Forma recente</h3>'+
 (f.recentCount?'<div class="insight-kpis"><div><span>Media últimos '+f.recentCount+'</span><strong>'+pts(f.recentAverage)+'</strong></div><div><span>Último partido</span><strong>'+pts(f.latest.points)+'</strong></div><div><span>Partidos publicados</span><strong>'+f.games+'</strong></div></div>'+
 '<div class="form-rounds">'+f.recent.map(p=>'<span>X'+p.round+' · '+pts(p.points)+' pts</span>').join('')+'</div><p class="mini muted">'+trend+'</p>':
 '<p class="insight-empty">Sen datos publicados. A forma aparecerá tras a primeira xornada.</p>')+'</section>';
}
export function priceHistorySection(data,id){
 const s=priceSeries(id,data.history,data.prices[id]);
 if(s.points.length<2)return '<section class="insight-section"><h3>Evolución do prezo</h3><p class="insight-empty">Prezo inicial: '+euro(s.openingPrice)+'. O historial aparecerá tras publicar a primeira xornada.</p></section>';
 const xy=chartPoints(s.points),poly=xy.map(p=>p.x+','+p.y).join(' ');
 const dots=xy.map((p,i)=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="3.6"><title>'+h(s.points[i].label)+' · '+euro(s.points[i].price)+'</title></circle>').join('');
 return '<section class="insight-section"><h3>Evolución do prezo</h3>'+
 '<svg class="price-chart" viewBox="0 0 340 108" role="img" aria-label="Evolución do prezo por xornada"><polyline points="'+poly+'"></polyline>'+dots+'</svg>'+
 '<div class="price-chart-labels"><span>Inicio · '+euro(s.openingPrice)+'</span><span>Actual · '+euro(s.currentPrice)+'</span></div>'+
 '<p class="mini muted">Variación desde o inicio: '+change(s)+'.</p>'+
 '<div class="price-history-rows">'+s.points.slice(1).reverse().map(x=>'<div class="row"><span>'+h(x.label)+'</span><b>'+euro(x.price)+'</b></div>').join('')+'</div></section>';
}
