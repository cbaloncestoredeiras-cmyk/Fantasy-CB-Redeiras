// Display-only movement based exclusively on published round snapshots.
// Never uses provisional stats, rosters, or unpublished future fixtures.
export function rankingMoves(fixtures=[],weeklyRanking=[],currentRows=[]){
 const completed=fixtures.filter(f=>f.status==='finalized')
   .slice().sort((a,b)=>Number(a.round_number)-Number(b.round_number));
 if(completed.length<2)return new Map();
 const previous=new Set(completed.slice(0,-1).map(f=>Number(f.round_number)));
 const totals=new Map();
 for(const row of weeklyRanking){
  if(!previous.has(Number(row.round_number)))continue;
  const id=row.team_id,score=Number(row.round_points);
  if(!id||!Number.isFinite(score))continue;
  totals.set(id,(totals.get(id)||0)+score);
 }
 if(!totals.size)return new Map();
 const ordered=[...totals.entries()].sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0])));
 const before=new Map();
 let lastValue=null,lastRank=0;
 for(const [index,[id,points]] of ordered.entries()){
  if(points!==lastValue){lastRank=index+1;lastValue=points;}
  before.set(id,lastRank);
 }
 return new Map(currentRows.filter(row=>before.has(row.team_id)&&Number.isFinite(Number(row.position)))
  .map(row=>[row.team_id,before.get(row.team_id)-Number(row.position)]));
}
