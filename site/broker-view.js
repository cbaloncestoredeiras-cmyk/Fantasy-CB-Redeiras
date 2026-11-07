import {pts,escapeHtml as h} from './logic.js';

const threshold = n=>Number.isFinite(n)?pts(n):'Non alcanzable';

export function brokerProfileHtml(price,estimate,playedGames=0){
  // Thresholds are approximate because broker prices are rounded to 5,000 euros.
  const cards=[
    {label:'Manter o prezo',number:threshold(estimate.expected),detail:'pts Fantasy'},
    {label:'Subir un 15 %',number:'≥ '+threshold(estimate.thresholdPlus15),detail:'pts Fantasy'},
    {label:'Baixar un 15 %',number:'≤ '+threshold(estimate.thresholdMinus15),detail:estimate.canReachMinus15?'pts Fantasy':'pts · limiar teórico'}
  ];
  return '<section class="broker-overview" aria-label="Prezo e obxectivos do bróker">'+
    '<div class="broker-price"><div class="kpi-label">Prezo actual</div><strong>'+h(new Intl.NumberFormat('es-ES',{maximumFractionDigits:2}).format((Number(price)||0)/1e6))+' M€</strong></div>'+
    '<div class="broker-targets">'+cards.map(c=>'<div class="broker-target"><span>'+h(c.label)+'</span><strong>'+h(c.number)+'</strong><small>'+h(c.detail)+'</small></div>').join('')+'</div>'+
    '<p class="broker-rounding">Limiares aproximados en puntos Fantasy.'+
    (estimate.canReachMinus15?'':' O descenso do 15 % non é alcanzable con este prezo: aínda cunha puntuación máis baixa, a caída máxima sería dun '+h(pts(Math.abs(estimate.maxDropPercent)))+' % polo prezo mínimo do bróker.')+'</p>'+
    '<details class="broker-explainer"><summary>Como funciona o bróker?</summary><div class="broker-explainer-content">'+
    '<p>O valor dos xogadores cambia despois de cada xornada publicada segundo a súa <b>media acumulada de puntos Fantasy</b>. Só contan os partidos nos que xogaron; os ausentes manteñen o prezo.</p>'+
    '<p>No Fantasy Redeiras, o <b>prezo teórico = 1.080.000 € + 125.000 € × media Fantasy</b>. O prezo achégase directamente a ese valor, cun límite máximo de <b>±15 %</b> por xornada, mínimo de 450.000 € e redondeo a 5.000 €.</p>'+
    '<p>Os puntos Fantasy inclúen a valoración deportiva e as bonificacións correspondentes. Por iso un xogador barato pode subir incluso cun resultado negativo, pero non todos os xogadores soben coa mesma puntuación.</p>'+
    '<p>Os limiares son orientativos polo redondeo a 5.000 €. Os símbolos ≥ e ≤ marcan os puntos Fantasy necesarios para acadar as variacións máximas, tendo en conta o redondeo de 5.000 €. Se o prezo mínimo de 450.000 € impide baixar o 15 %, o valor amósase só como limiar teórico.</p>'+
    '<p class="mini muted">Partidos Fantasy puntuados: '+Math.max(0,Number(playedGames)||0)+'.</p>'+
    '</div></details></section>';
}
