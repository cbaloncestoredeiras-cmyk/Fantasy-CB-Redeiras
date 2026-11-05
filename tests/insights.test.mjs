import test from 'node:test';
import assert from 'node:assert/strict';
import {recentPlayerGames,playerForm,priceSeries,chartPoints} from '../site/insights.js';
import {formBadge,compareButton,comparisonPanel,formSection,priceHistorySection} from '../site/insights-view.js';

const fixtures=Array.from({length:7},(_,i)=>({id:'fixture-'+(5+i),round_number:5+i,status:i===6?'scheduled':'finalized'}));
const stats=[5,6,7,8,9,10].map((round,i)=>({player_id:'p1',fixture_id:'fixture-'+round,played:true,fantasy_points:[2,4,6,10,12,16][i]}));
stats.push({player_id:'p1',fixture_id:'fixture-11',played:true,fantasy_points:99});
stats.push({player_id:'p1',fixture_id:'fixture-10',played:false,fantasy_points:500});
stats.push({player_id:'p2',fixture_id:'fixture-10',played:true,fantasy_points:0});

test('form only uses played scores from finalized rounds; excludes drafts',()=>{
 const games=recentPlayerGames('p1',fixtures,stats);
 assert.equal(games.length,6);
 assert.deepEqual(games.map(x=>x.round),[10,9,8,7,6,5]);
 const f=playerForm('p1',fixtures,stats);
 assert.equal(f.recentAverage,(16+12+10)/3);
 assert.equal(f.latest.points,16);
 assert.equal(f.games,6);
 assert.equal(f.trend,'up');
 assert.equal(playerForm('p2',fixtures,stats).recentAverage,0);
 assert.equal(playerForm('unknown',fixtures,stats).recentAverage,null);
});
test('trend is unavailable until there are six official games',()=>{
 const f=playerForm('p1',fixtures.slice(0,5),stats);
 assert.equal(f.games,5);
 assert.equal(f.trend,null);
 assert.equal(f.previousAverage,null);
});
test('history uses final round-0 opening price rather than provisional price',()=>{
 const history=[
  {player_id:'p1',round_number:0,price_before:700000,price_after:950000},
  {player_id:'p1',round_number:5,price_before:950000,price_after:1045000},
  {player_id:'p1',round_number:6,price_before:1045000,price_after:1000000},
  {player_id:'p2',round_number:6,price_before:800000,price_after:900000}
 ];
 const s=priceSeries('p1',history,1000000);
 assert.deepEqual(s.points.map(x=>x.label),['Inicio','X5','X6']);
 assert.equal(s.openingPrice,950000);
 assert.equal(s.delta,50000);
 assert.equal(s.playedChanges,2);
 assert.ok(Math.abs(s.pct-5.26315789)<0.0001);
 const fallback=priceSeries('p1',[],1000000);
 assert.equal(fallback.points.length,1);
 assert.equal(fallback.pct,0);
});
test('price chart positions are finite and bounded even for flat history',()=>{
 for(const rows of [[{price:1000000}],[{price:1000000},{price:1000000}],[{price:700000},{price:900000}]]){
  const points=chartPoints(rows);
  assert.equal(points.length,rows.length);
  assert.ok(points.every(p=>p.x>=0&&p.x<=340&&p.y>=0&&p.y<=108));
 }
});
const data={
 players:[{id:'p1',name:'Xoán',positions:['BA'],category:'senior'}],
 playerMap:{p1:{id:'p1',name:'Xoán',positions:['BA'],category:'senior'}},
 prices:{p1:1000000},
 history:[{player_id:'p1',round_number:0,price_after:950000},{player_id:'p1',round_number:5,price_before:950000,price_after:1000000}],
 fixtures,stats
};
test('comparison and player insights are read-only, render the expected metrics and missing-state copy',()=>{
 assert.match(formBadge(data,'p1'),/Forma/);
 assert.match(compareButton('p1',['p1']),/aria-pressed="true"/);
 const panel=comparisonPanel(data,['p1'],p=>'<b>'+p.name+'</b>');
 assert.match(panel,/Comparador de xogadores/);
 assert.match(panel,/Ver perfil e historial/);
 assert.match(panel,/Forma \(últimos 3\)/);
 assert.match(formSection(data,'p1'),/X10/);
 assert.match(priceHistorySection(data,'p1'),/role="img"/);
 assert.match(priceHistorySection(data,'p1'),/Inicio/);
 const clean={...data,stats:[],history:[]};
 assert.match(formSection(clean,'p1'),/Sen datos publicados/);
 assert.match(priceHistorySection(clean,'p1'),/historial aparecerá/);
});
