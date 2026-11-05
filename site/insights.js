// Read-only insights: use published Fantasy results, never pre-publication drafts.
const number=value=>Number(value);
const validPrice=value=>Number.isFinite(number(value))&&number(value)>0;
export function recentPlayerGames(playerId,fixtures=[],stats=[]){
  const finalized=new Map(fixtures.filter(f=>f.status==='finalized').map(f=>[f.id,Number(f.round_number)]));
  return stats.filter(s=>s.player_id===playerId && finalized.has(s.fixture_id) &&
    s.played===true && s.fantasy_points!==null && s.fantasy_points!==undefined &&
    Number.isFinite(number(s.fantasy_points)))
    .map(s=>({round:finalized.get(s.fixture_id),points:number(s.fantasy_points)}))
    .sort((a,b)=>b.round-a.round);
}

export function playerForm(playerId,fixtures=[],stats=[]){
  const all=recentPlayerGames(playerId,fixtures,stats);
  const last=all.slice(0,3);
  const avg=rows=>rows.reduce((sum,row)=>sum+row.points,0)/rows.length;
  const previous=all.slice(3,6);
  const recentAverage=last.length?avg(last):null;
  const previousAverage=previous.length===3&&last.length===3?avg(previous):null;
  const difference=previousAverage===null?null:recentAverage-previousAverage;
  return {
    games:all.length,recentCount:last.length,recentAverage,
    latest:last.length?last[0]:null,recent:last,
    previousAverage,difference,
    trend:difference===null?null:difference>2?'up':difference< -2?'down':'stable'
  };
}

// Opening price is the post-review round-0 price, not the earlier provisional price.
export function priceSeries(playerId,history=[],currentPrice){
  const rows=history.filter(r=>r.player_id===playerId&&Number.isInteger(number(r.round_number))&&
    number(r.round_number)>=0&&validPrice(r.price_after))
    .slice().sort((a,b)=>number(a.round_number)-number(b.round_number));
  const opening=rows.find(r=>number(r.round_number)===0);
  const changes=rows.filter(r=>number(r.round_number)>0);
  const baseline=opening?number(opening.price_after):changes.length&&validPrice(changes[0].price_before)?
    number(changes[0].price_before):validPrice(currentPrice)?number(currentPrice):0;
  const points=[{round:0,label:'Inicio',price:baseline}];
  for(const row of changes){
    const latest=points[points.length-1];
    if(latest.round===number(row.round_number)){
      latest.price=number(row.price_after);
    }else points.push({round:number(row.round_number),label:'X'+number(row.round_number),price:number(row.price_after)});
  }
  const price=validPrice(currentPrice)?number(currentPrice):points[points.length-1].price;
  if(points[points.length-1].price!==price){
    points.push({round:null,label:'Actual',price});
  }
  const delta=price-baseline;
  return {points,openingPrice:baseline,currentPrice:price,delta,pct:baseline?100*delta/baseline:0,playedChanges:changes.length};
}

export function chartPoints(series,width=340,height=108){
  if(!series.length)return [];
  const values=series.map(row=>number(row.price));
  const low=Math.min(...values),high=Math.max(...values);
  const span=Math.max(high-low,Math.max(1,high)*.04);
  const min=low-(span-(high-low))/2;
  const top=high+(span-(high-low))/2;
  return series.map((row,i)=>({
    x:Math.round(16+(width-32)*(series.length===1?.5:i/(series.length-1))),
    y:Math.round(10+(height-20)*(top-row.price)/(top-min))
  }));
}
