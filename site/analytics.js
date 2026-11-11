// V1.4 analytics: all calculations are read-only and use only finalized fixtures.
// Never derive other managers' private rosters or unfinalized box scores.
const finite=n=>Number.isFinite(Number(n))?Number(n):0;
const round2=n=>Math.round(n*100)/100;
export function finalizedPlayerRows(data,id){
 const done=new Map((data.fixtures||[]).filter(f=>f.status==='finalized').map(f=>[f.id,f.round_number]));
 return (data.stats||[]).filter(s=>s.player_id===id&&done.has(s.fixture_id)&&s.played===true&&s.fantasy_points!==null&&s.fantasy_points!==undefined)
 .map(s=>({...s,round:done.get(s.fixture_id),fantasy_points:finite(s.fantasy_points)}))
 .sort((a,b)=>a.round-b.round);
}
const FIELDS=[['fantasy_points','Fantasy'],['pir','Valoración'],['points','Puntos'],['rebounds','Rebotes'],['assists','Asistencias'],['steals','Recuperacións'],['blocks','Tapóns'],['turnovers','Perdas'],['minutes','Minutos'],['vote_bonus','Bonus votos']];
export function playerSeasonStats(data,id){
 const games=finalizedPlayerRows(data,id),count=games.length,totals={},averages={},observedGames={};
 for(const [key] of FIELDS){
  // Unrecorded rebounds/assists are NOT observed zeros. These optional
  // statistics do not contribute to Fantasy scoring.
  const seen=key==='rebounds'||key==='assists'
    ?games.filter(g=>g[key+'_recorded']===true):games;
  const sum=seen.reduce((n,row)=>n+finite(row[key]),0);
  observedGames[key]=seen.length;
  totals[key]=seen.length?round2(sum):null;
  averages[key]=seen.length?round2(sum/seen.length):null;
 }
 const fantasy=games.map(g=>g.fantasy_points),best=count?Math.max(...fantasy):null;
 const recent=count?games.slice(-3):[];
 return {playerId:id,games,played:count,totals,averages,observedGames,best,
  latest:count?games[count-1]:null,
  recentAverage:recent.length?round2(recent.reduce((n,r)=>n+r.fantasy_points,0)/recent.length):null,
  consistency:count>=2?round2(Math.sqrt(games.reduce((s,g)=>s+(g.fantasy_points-averages.fantasy_points)**2,0)/count)):null};
}
export function leaderboardLeaders(data){
 const values=(data.players||[]).map(p=>({player:p,metrics:playerSeasonStats(data,p.id)})).filter(v=>v.metrics.played>0);
 return values.sort((a,b)=>b.metrics.averages.fantasy_points-a.metrics.averages.fantasy_points||a.player.name.localeCompare(b.player.name));
}
export function seasonRecords(data){
 const done=new Set((data.fixtures||[]).filter(f=>f.status==='finalized').map(f=>f.round_number));
 const rounds=(data.weeklyRanking||[]).filter(r=>done.has(Number(r.round_number))).slice();
 const bestRound=rounds.length?rounds.sort((a,b)=>finite(b.round_points)-finite(a.round_points)||Number(a.round_number)-Number(b.round_number))[0]:null;
 const topPlayer=leaderboardLeaders(data).sort((a,b)=>b.metrics.best-a.metrics.best)[0]||null;
 const winners=(data.fixtures||[]).filter(f=>f.status==='finalized').sort((a,b)=>a.round_number-b.round_number).map(f=>({
  round:f.round_number,
  winner:(data.weeklyRanking||[]).filter(r=>Number(r.round_number)===Number(f.round_number))
   .sort((a,b)=>Number(a.position)-Number(b.position))[0]||null
 })).filter(x=>x.winner);
 const wins=new Map();
 for(const r of winners){
  const id=r.winner.team_id;
  wins.set(id,{wins:(wins.get(id)?.wins||0)+1,name:r.winner.team_name});
 }
 const mostWins=[...wins.values()].sort((a,b)=>b.wins-a.wins||a.name.localeCompare(b.name))[0]||null;
 let comeback=null;
 // This metric measures improvements in the general standings between
 // consecutive completed rounds; it uses only published team points.
 const fixtures=(data.fixtures||[]).filter(f=>f.status==='finalized').sort((a,b)=>a.round_number-b.round_number);
 const cumul=new Map(),priorRank=new Map();
 for(const f of fixtures){
  const results=(data.weeklyRanking||[]).filter(t=>Number(t.round_number)===Number(f.round_number));
  for(const t of results)cumul.set(t.team_id,(cumul.get(t.team_id)||0)+finite(t.round_points));
  const ranked=[...cumul].sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0])));
  const thisRank=new Map(ranked.map(([id],i)=>[id,i+1]));
  for(const t of results){
   const prior=priorRank.get(t.team_id),current=thisRank.get(t.team_id);
   if(prior!=null&&prior-current>0&&(!comeback||prior-current>comeback.places)){
    comeback={teamName:t.team_name,places:prior-current,round:f.round_number};
   }
  }
  for(const [id,rank] of thisRank)priorRank.set(id,rank);
 }
 return {bestRound,topPlayer,mostWins,comeback,completed:fixtures.length};
}
export function popularityRows(data){
 const rows=Array.isArray(data.popularity)?data.popularity:[];
 // Only the last published fixture has frozen lineups suitable for public popularity.
 const latest=(data.fixtures||[]).filter(f=>f.status==='finalized')
   .sort((a,b)=>Number(b.round_number)-Number(a.round_number))[0];
 const called=latest?new Set((data.callups||[]).filter(c=>c.fixture_id===latest.id).map(c=>c.player_id)):null;
 const fromApi=new Map(rows.map(row=>[row.player_id,row]));
 const denominator=Number(rows.find(row=>Number(row.total_teams)>0)?.total_teams||0);
 // Show every market player, including 0–2 choices. Preserve privacy:
 // if the RPC masks a count, never recover or infer it by accessing team rosters.
 return (data.players||[]).map(player=>{
   const row=fromApi.get(player.id);
   return {player,picks:row?.pick_count==null?null:Number(row.pick_count),
     total:Number(row?.total_teams||denominator),
     pct:row?.pick_percent==null?null:Number(row.pick_percent),
     called:called?called.has(player.id):null};
 }).filter(x=>x.total>0)
 .sort((a,b)=>(b.pct??-1)-(a.pct??-1)||a.player.name.localeCompare(b.player.name));
}
export {FIELDS};
