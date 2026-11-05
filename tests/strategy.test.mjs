import test from 'node:test';
import assert from 'node:assert/strict';
import {simulatedLineup,priceBeforeRound,idealQuintet} from '../site/strategy.js';
import {simulatorPanel,idealTeamPanel} from '../site/strategy-view.js';

const ids=['a','b','c','d','e','f','g'];
const positions=[['BA'],['AP'],['ES'],['P'],['AL'],['AL'],['AL']];
const players=ids.map((id,i)=>({id,name:'Xogador '+id.toUpperCase(),positions:positions[i],active:true,available_from_round:5}));
const priceMap={a:1e6,b:1e6,c:1e6,d:1e6,e:1e6,f:500000,g:1500000};
const fixture={id:'fixture-5',round_number:5,status:'finalized'};
const pending={id:'fixture-6',round_number:6,status:'scheduled'};
const score=[20,18,15,10,9,100,30];
const stats=ids.map((id,i)=>({fixture_id:'fixture-5',player_id:id,played:true,fantasy_points:score[i]}));
stats.push({fixture_id:'fixture-6',player_id:'f',played:true,fantasy_points:999});
const history=ids.map(id=>({player_id:id,round_number:0,price_after:id==='f'?2500000:priceMap[id]}));
history.push({player_id:'f',round_number:5,price_before:2500000,price_after:500000});
const data={
 season:{starting_budget:6000000,max_transfers:3,start_round:5},
 team:{id:'team',cash:1000000},roster:['a','b','c','d','e'],
 transfers:[{round_number:6},{round_number:6}],
 players,playerMap:Object.fromEntries(players.map(p=>[p.id,p])),prices:priceMap,
 stats,history,fixtures:[fixture,pending]
};

test('simulator respects server rules for price, positions and remaining transfers without mutating data',()=>{
 const before=JSON.stringify(data);
 const s=simulatedLineup(data,['a','b','c','g','e'],6);
 assert.equal(s.valid,true);
 assert.equal(s.cashAfter,500000);
 assert.deepEqual(s.removed,['d']);
 assert.deepEqual(s.added,['g']);
 assert.equal(s.changes,1);
 assert.equal(s.spent,2);
 assert.equal(s.changesLeft,0);
 const over=simulatedLineup(data,['a','b','c','g','f'],6);
 assert.equal(over.changes,2);
 assert.equal(over.valid,false);
 assert.equal(over.changesLeft,-1);
 const noBase=simulatedLineup(data,['b','c','d','e','g'],6);
 assert.equal(noBase.valid,false);
 assert.equal(JSON.stringify(data),before);
});

test('initial team simulator counts building five players as 0 transfers and observes 6 M budget',()=>{
 const novice={...data,team:null,roster:[],transfers:[]};
 const good=simulatedLineup(novice,['a','b','c','d','e'],5);
 assert.equal(good.valid,true);
 assert.equal(good.cashAfter,1000000);
 assert.equal(good.changes,0);
 const bad=simulatedLineup(novice,['a','b','c','g','f'],5);
 assert.equal(bad.valid,true);
 assert.equal(bad.cashAfter,2000000);
});

test('opening-of-round price never uses post-match broker changes',()=>{
 assert.equal(priceBeforeRound('f',5,data.history,data.prices),2500000);
 assert.equal(priceBeforeRound('f',6,data.history,data.prices),500000);
 assert.equal(priceBeforeRound('a',5,data.history,data.prices),1000000);
});

test('ideal quintet maximizes published points with five distinct players, roles and 6 M at historical prices',()=>{
 const ideal=idealQuintet(data,5);
 assert.ok(ideal);
 assert.equal(ideal.players.length,5);
 assert.equal(new Set(ideal.players.map(p=>p.id)).size,5);
 assert.equal(ideal.cost,5500000);
 assert.equal(ideal.points,93);
 assert.ok(ideal.players.some(p=>p.id==='a'));
 assert.ok(ideal.players.some(p=>p.id==='b'));
 assert.ok(ideal.players.some(p=>p.id==='g'));
 assert.ok(!ideal.players.some(p=>p.id==='f'),'Excessively expensive at market close');
 assert.equal(idealQuintet(data,6),null,'Unpublished round must never produce an ideal');
 const missing={...data,stats:[]};
 assert.equal(idealQuintet(missing,5),null);
});

test('simulator and ideal panels convey historical values and never submit an RPC',()=>{
 const person=p=>'<b>'+p.name+'</b>';
 const preview=simulatorPanel(data,['a','b','c','g','e'],6,false);
 assert.match(preview,/Simulador de fichaxes/);
 assert.match(preview,/Aquí non se garda/);
 assert.match(preview,/Mercado pechado/);
 assert.match(preview,/Restaurar quinteto actual/);
 assert.doesNotMatch(preview,/fantasy_change_lineup/);
 const ideal=idealTeamPanel(data,5,person);
 assert.match(ideal,/Equipo ideal · X5/);
 assert.match(ideal,/5\.500\.000/);
 assert.match(ideal,/PUBLICADO/);
 assert.match(idealTeamPanel(data,6,person),/Aparecerá cando se publique/);
});

test('ranking page can switch between overall and official single-round scores',async()=>{
 const root={innerHTML:''};
 globalThis.document={querySelector:s=>s==='#root'?root:null};
 globalThis.window={FANTASY_CONFIG:{}};
 const views=await import('../site/pages.js');
 const d={...data,role:'participant',club:{id:'club'},photoUrls:{},team:{...data.team,name:'Proba'},
  leaderboard:[{position:1,team_id:'team',team_name:'Líder Xeral',manager_alias:'Xan',total_points:101}],
  weeklyRanking:[{round_number:5,position:1,team_id:'team',team_name:'Gañador X5',manager_alias:'Xan',round_points:93}],
  weeklyRankingError:null,fixtures:[fixture,pending],alias:'Xan',callups:[],eligibleFixtures:[],linkedPlayer:null};
 views.state.data=d;
 const original=views.state.rankRound;
 try{
  views.state.rankRound='general';
  const general=views.ranking();
  assert.match(general,/Líder Xeral/);
  assert.match(general,/id="ranking-round"/);
  assert.match(general,/Equipo ideal · X5/);
  views.state.rankRound='5';
  const weekly=views.ranking();
  assert.match(weekly,/Gañador X5/);
  assert.doesNotMatch(weekly,/Líder Xeral/);
  assert.match(weekly,/Puntos oficiais desta xornada/);
 }finally{views.state.rankRound=original;}
});
