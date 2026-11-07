// Shared client-side previews. The database RPCs are the authoritative validators.
export const FANTASY_BUDGET = 6_000_000;
export const MAX_TRANSFERS = 3;
export const euro = n => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n||0);
export const pts = n => new Intl.NumberFormat('es-ES',{maximumFractionDigits:2}).format(Number(n)||0);
export const byId = arr => Object.fromEntries((arr||[]).map(x=>[x.id,x]));
export const escapeHtml = text => String(text ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const hasPosition = (p,pos) => (p?.positions||[]).includes(pos);
export const isInterior = p => hasPosition(p,'AP')||hasPosition(p,'P');

export function validateLineup(ids,players,prices){
  const unique=[...new Set(ids)];
  const chosen=unique.map(id=>players[id]).filter(Boolean);
  const cost=chosen.reduce((s,p)=>s+(prices[p.id]||0),0);
  const pair=chosen.flatMap(b=>hasPosition(b,'BA')?chosen.filter(i=>i.id!==b.id&&isInterior(i)).map(i=>[b,i]):[])[0];
  const base=pair?.[0]||chosen.find(p=>hasPosition(p,'BA'));
  const inside=pair?.[1]||null;
  const valid=ids.length===5&&unique.length===5&&chosen.length===5&&!!pair;
  return {valid,cost,base:base?.id||null,inside:inside?.id||null,
    errors:[...(ids.length!==5?['Precisas exactamente 5 xogadores']:[]),
    ...(unique.length!==ids.length?['Hai xogadores repetidos']:[]),
    ...(!base?['Falta un base (BA)']:[]),
    ...(!inside?['Falta un interior (AP/P) diferente do base']:[])]};
}

export function transferPlan(oldIds,newIds,cash,prices){
  const removed=oldIds.filter(x=>!newIds.includes(x));
  const added=newIds.filter(x=>!oldIds.includes(x));
  const sales=removed.reduce((s,id)=>s+(prices[id]||0),0);
  const buys=added.reduce((s,id)=>s+(prices[id]||0),0);
  return {removed,added,sales,buys,cashAfter:cash+sales-buys,changes:removed.length};
}

// Browser-only preview. The SQL private.next_price function is authoritative.
// Redeiras V3 (ACB-inspired): cumulative Fantasy average determines the theoretical
// price directly. Only +/-15%, 450k floor and nearest 5k rounding constrain it.
// Played zero-score matches count; absences never alter price or the mean.
export const BROKER_MODEL=Object.freeze({
  base:1_080_000,perPoint:125_000,pacing:1,
  floor:450_000,maxChange:0.15,roundTo:5_000
});
export function brokerEstimate(price,points,played=true,previousPoints=[]){
  const history=(Array.isArray(previousPoints)?previousPoints:[]).map(Number).filter(Number.isFinite);
  const pastTotal=history.reduce((sum,score)=>sum+score,0);
  const games=history.length+1;
  const average=(pastTotal+(Number(points)||0))/games;
  const {base,perPoint,floor,roundTo}=BROKER_MODEL;
  // Exact integer percentage arithmetic avoids float rounding at price bands.
  const high=Math.floor(price*115/(100*roundTo))*roundTo;
  const low=Math.ceil(price*85/(100*roundTo))*roundTo;
  const target=Math.max(floor,base+perPoint*average);
  // Stabilize binary floating point at exact 2,500 € rounding ties (SQL uses exact numeric).
  const suggested=Math.round((target+1e-6)/roundTo)*roundTo;
  const after=played?Math.max(floor,Math.min(high,Math.max(low,suggested))):price;
  const requiredScore=theoreticalPrice=>((theoreticalPrice-base)/perPoint)*games-pastTotal;
  // Published fantasy points use 2 decimal places. These are *attainable*
  // limits at that precision, including the 5k price rounding boundaries.
  const upBoundary=requiredScore(high-roundTo/2);
  const downBoundary=requiredScore(low+roundTo/2);
  const ceilCents=n=>Math.ceil(n*100-1e-8)/100;
  const minimumPrice=Math.max(floor,Math.min(high,Math.max(low,Math.round(floor/roundTo)*roundTo)));
  return {
    before:price,after,delta:after-price,
    average:played?average:(history.length?pastTotal/history.length:null),
    playedGames:history.length+(played?1:0),
    target,expected:requiredScore(price),
    thresholdPlus15:ceilCents(upBoundary),      // >= score
    thresholdMinus15:ceilCents(downBoundary)-0.01, // <= score
    canReachMinus15:minimumPrice===low,
    maxDropPercent:(minimumPrice-price)/price*100
  };
}

export function pickUpcoming(fixtures,season){
  const sorted=[...(fixtures||[])].filter(f=>f.round_number>=season.start_round).sort((a,b)=>a.round_number-b.round_number);
  const pending=sorted.find(f=>f.status!=='finalized'&&f.status!=='cancelled');
  const previous=sorted.find(f=>f.round_number===pending?.round_number-1);
  const open=!!pending&&pending.status==='scheduled'&&!!pending.starts_at
    &&new Date(pending.starts_at).getTime()>Date.now()
    &&(!previous || previous.status==='finalized');
  return {pending,previous,open};
}

export function parseDelimited(input,separator){
  const text=String(input||'').replace(/^\ufeff/,'');
  const first=text.split(/\r?\n/,1)[0];
  const sep=separator||(first.includes('\t')?'\t':(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',');
  const rows=[],row=[];let field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
    else if(c===sep&&!quoted){row.push(field);field='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(v=>String(v).trim()))rows.push([...row]);row.length=0;field='';}
    else field+=c;
  }
  row.push(field);if(row.some(v=>String(v).trim()))rows.push(row);
  if(quoted)throw new Error('CSV malformado: comiñas sen pechar');
  return rows;
}
const norm=t=>String(t??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
export function rowsFromTable(table,players){
  if(!Array.isArray(table)||table.length<2)return [];
  const headers=table[0].map(norm);
  const idx=(...names)=>headers.findIndex(x=>names.includes(x));
  const cols={
    player:idx('jugador','xogador','player','nome','nombre','name'),
    pir:idx('pir','valoracion','valoracionacb','val','valacb'),
    min:idx('min','minutos','minutes','tempo'),
    pts:idx('pts','puntos','points','ptos'),
    reb:idx('reb','rebotes','rebounds'),
    ast:idx('ast','asistencias','assists','asis'),
    stl:idx('stl','robos','steals','recuperaciones'),
    blk:idx('blk','tapones','blocks'),
    tov:idx('tov','perdidas','turnovers')
  };
  // Never silently use EFF when PIR isn't present.
  if(cols.player===-1||cols.pir===-1)throw new Error('A táboa necesita columnas Xogador e PIR/Valoración (EFF non equivale a PIR).');
  const names=Object.fromEntries(players.map(p=>[norm(p.name),p.id]));
  const number=value=>{
    const raw=String(value??'').trim();if(raw==='')return 0;
    const n=Number(raw.replace(',','.'));return Number.isFinite(n)?n:NaN;
  };
  return table.slice(1).filter(row=>row.some(x=>String(x??'').trim())).map((row,i)=>{
    const name=String(row[cols.player]??'').trim(), player_id=names[norm(name)]||'';
    const minutes=cols.min>=0?number(row[cols.min]):0;
    const pir=number(row[cols.pir]);
    if(!Number.isFinite(pir)||!Number.isFinite(minutes))throw new Error('Número incorrecto na fila '+(i+2));
    return {player_id,name,minutes,pir,played:minutes>0||pir!==0,
      points:cols.pts>=0?number(row[cols.pts]):0,
      rebounds:cols.reb>=0?number(row[cols.reb]):0,
      assists:cols.ast>=0?number(row[cols.ast]):0,
      steals:cols.stl>=0?number(row[cols.stl]):0,
      blocks:cols.blk>=0?number(row[cols.blk]):0,
      turnovers:cols.tov>=0?number(row[cols.tov]):0};
  });
}
