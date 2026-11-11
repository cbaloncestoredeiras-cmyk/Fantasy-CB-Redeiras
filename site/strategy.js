// Only client-side read-only calculations. The Supabase RPCs remain authoritative.
import {FANTASY_BUDGET,MAX_TRANSFERS,validateLineup,transferPlan,originalPlayerUsage} from './logic.js';
import {playerForm} from './insights.js';

export function simulatedLineup(data,draft,round){
 const initial=!data.team;
 const startingBudget=Number(data.season?.starting_budget||FANTASY_BUDGET);
 const max=Number(data.season?.max_transfers||MAX_TRANSFERS);
 const selection=validateLineup(draft,data.playerMap,data.prices);
 const trade=initial?{removed:[],added:[...draft],sales:0,buys:selection.cost,cashAfter:startingBudget-selection.cost,changes:0}:
   transferPlan(data.roster,draft,Number(data.team.cash),data.prices);
 const usage=originalPlayerUsage(data.transferStatus,data.roster,draft,data.transfers,round);
 const spent=initial?0:usage.used;
 const changesLeft=initial?max:usage.remainingAfter;
 const valid=selection.valid && trade.cashAfter>=0 && changesLeft>=0 && (initial||usage.valid) &&
   (!data.players||draft.every(id=>data.playerMap[id]&&Number(data.playerMap[id].available_from_round||0)<=Number(round)));
 const estimate=ids=>{
   if(ids.length!==5)return null;
   const forms=ids.map(id=>playerForm(id,data.fixtures||[],data.stats||[]));
   return forms.every(f=>f.recentCount>0)?
      forms.reduce((sum,f)=>sum+f.recentAverage,0):null;
 };
 return {...trade,selection,spent,max,changesLeft,valid,uniqueOriginalChangesAfter:usage.usedAfter,
   oldEstimate:initial?null:estimate(data.roster),newEstimate:estimate(draft),
   hasDifferences:initial?draft.length>0:trade.changes>0};
}

// Reconstruct the pre-match price. Changes of the current round are not usable
// because they were calculated after the market closed.
export function priceBeforeRound(playerId,round,history=[],currentPrices={}){
 const rows=history.filter(row=>row.player_id===playerId&&Number(row.round_number)<Number(round)&&
   Number.isFinite(Number(row.price_after))&&Number(row.price_after)>0)
   .slice().sort((a,b)=>Number(b.round_number)-Number(a.round_number));
 return rows.length?Number(rows[0].price_after):Number(currentPrices[playerId]||0);
}

export function idealQuintet(data,round){
 const fixture=(data.fixtures||[]).find(f=>Number(f.round_number)===Number(round)&&f.status==='finalized');
 if(!fixture)return null;
 const scores=new Map((data.stats||[]).filter(s=>s.fixture_id===fixture.id&&s.fantasy_points!==null&&
   s.fantasy_points!==undefined&&Number.isFinite(Number(s.fantasy_points)))
   .map(s=>[s.player_id,Number(s.fantasy_points)]));
 const budget=Number(data.season?.starting_budget||FANTASY_BUDGET);
 const candidates=(data.players||[]).filter(p=>scores.has(p.id)&&Number(p.available_from_round||0)<=Number(round))
  .map(p=>({...p,price:priceBeforeRound(p.id,round,data.history||[],data.prices||{}),points:scores.get(p.id)}))
  .filter(p=>p.price>0).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 let best=null;
 const n=candidates.length;
 for(let a=0;a<n-4;a++)for(let b=a+1;b<n-3;b++)for(let c=b+1;c<n-2;c++)
 for(let d=c+1;d<n-1;d++)for(let e=d+1;e<n;e++){
  const chosen=[candidates[a],candidates[b],candidates[c],candidates[d],candidates[e]];
  const cost=chosen.reduce((s,p)=>s+p.price,0);
  if(cost>budget)continue;
  const hasBase=chosen.some(p=>(p.positions||[]).includes('BA')&&
    chosen.some(other=>other.id!==p.id&&((other.positions||[]).includes('AP')||(other.positions||[]).includes('P'))));
  if(!hasBase)continue;
  const total=chosen.reduce((s,p)=>s+p.points,0);
  if(!best||total>best.points+1e-9||(Math.abs(total-best.points)<1e-9&&cost<best.cost)){
   best={round:Number(round),players:chosen,points:Math.round(total*100)/100,cost,budget};
  }
 }
 return best;
}
