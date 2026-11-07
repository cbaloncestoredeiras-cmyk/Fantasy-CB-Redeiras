import test from 'node:test';
import assert from 'node:assert/strict';
import {
 FANTASY_BUDGET,validateLineup,transferPlan,brokerEstimate,pickUpcoming,parseDelimited,rowsFromTable
} from '../site/logic.js';

const players={
 ba:{id:'ba',name:'Base',positions:['BA','ES']},
 ap:{id:'ap',name:'Interior',positions:['AP','P']},
 x1:{id:'x1',name:'Alero',positions:['AL','ES']},
 x2:{id:'x2',name:'Alero B',positions:['AL','ES']},
 x3:{id:'x3',name:'Junior',positions:['AL','AP']},
 y:{id:'y',name:'Extra',positions:['BA']}
};
const prices={ba:1_500_000,ap:1_300_000,x1:1_000_000,x2:800_000,x3:850_000,y:2_000_000};

test('budget initial is 6M',()=>assert.equal(FANTASY_BUDGET,6_000_000));
test('valid flex 5 with BA and AP/P',()=>{
 const x=validateLineup(['ba','ap','x1','x2','x3'],players,prices);
 assert.equal(x.valid,true);assert.equal(x.cost,5_450_000);
});
test('rejects duplicate, 4 players and no interior',()=>{
 assert.equal(validateLineup(['ba','ba','ap','x2','x3'],players,prices).valid,false);
 assert.equal(validateLineup(['ba','ap','x1','x2'],players,prices).valid,false);
 assert.equal(validateLineup(['ba','y','x1','x2','x1'],players,prices).valid,false);
});
test('transfer cash uses current market prices',()=>{
 const x=transferPlan(['ba','ap','x1','x2','x3'],['ba','ap','x1','x2','y'],550_000,prices);
 assert.deepEqual(x.removed,['x3']);assert.deepEqual(x.added,['y']);
 assert.equal(x.cashAfter,-600_000);assert.equal(x.changes,1);
});
test('no match -> unchanged broker price',()=>{
 const x=brokerEstimate(1_800_000,-5,false);
 assert.equal(x.after,1_800_000);
});
test('broker is capped to +/- 15 percent with 450k floor',()=>{
 const current=1_800_000;
 const high=brokerEstimate(current,100,true).after;
 const low=brokerEstimate(current,-100,true).after;
 assert.ok(high*100<=current*115);assert.ok(low*100>=current*85);
 assert.ok(brokerEstimate(450000,-100,true).after>=450000);
});
test('V3: all players use one formula with direct ±15% moves',()=>{
 const iago=700_000,brais=1_100_000,juan=2_250_000;
 assert.equal(brokerEstimate(iago,-1,true).after,805_000);
 assert.equal(brokerEstimate(iago,-5,true).after,595_000);
 assert.equal(brokerEstimate(brais,-1,true).after,955_000);
 assert.equal(brokerEstimate(juan,3,true).after,1_915_000);
 assert.equal(brokerEstimate(juan,13,true).after,2_585_000);
 assert.equal(brokerEstimate(1_200_000,1,true).after,1_205_000);
 assert.equal(brokerEstimate(1_500_000,3,true).after,1_455_000);
 assert.equal(brokerEstimate(juan,5,true).after,1_915_000);
 assert.equal(brokerEstimate(iago,0,false).after,iago);
});
test('V3: attainable thresholds match actual price changes at 0.01 Fantasy points',()=>{
 for(const price of [700_000,850_000,900_000,1_100_000,1_350_000,2_250_000]){
   for(const prior of [[],[12],[-2,4,8]]){
     const e=brokerEstimate(price,0,true,prior);
     const maxUp=Math.floor(price*115/(100*5_000))*5_000;
     const maxDown=Math.ceil(price*85/(100*5_000))*5_000;
     assert.equal(brokerEstimate(price,e.thresholdPlus15,true,prior).after,maxUp,
       'up threshold '+price+' history '+prior);
     assert.ok(brokerEstimate(price,Number((e.thresholdPlus15-.01).toFixed(2)),true,prior).after<maxUp);
     if(e.canReachMinus15){
       assert.equal(brokerEstimate(price,Number(e.thresholdMinus15.toFixed(2)),true,prior).after,maxDown);
       assert.ok(brokerEstimate(price,Number((e.thresholdMinus15+.01).toFixed(2)),true,prior).after>maxDown);
     }
   }
 }
});
test('V3: past big scores allow +15% growth even on a poor next game',()=>{
 const first=brokerEstimate(700_000,20,true);
 assert.equal(first.after,805_000);
 const second=brokerEstimate(first.after,-12,true,[20]);
 assert.equal(second.average,4);
 assert.equal(second.after,925_000);
 assert.ok(second.thresholdPlus15<0);
 assert.equal(second.playedGames,2);
});
test('V3: skipped matches do not move prices or affect the average',()=>{
 const prior=[20];
 const original=805_000;
 assert.equal(brokerEstimate(original,-50,false,prior).after,original);
 assert.equal(brokerEstimate(original,-50,false,prior).playedGames,1);
 assert.equal(brokerEstimate(original,0,true,prior).average,10);
 assert.equal(brokerEstimate(original,0,true,prior).playedGames,2);
});
test('V3: low-price floor limits loss but never allows falling below 450k',()=>{
 const e=brokerEstimate(450_000,-100,true);
 assert.equal(e.after,450_000);
 assert.equal(e.canReachMinus15,false);
 assert.equal(e.maxDropPercent,0);
 assert.ok(Number.isFinite(e.thresholdMinus15));
});
test('V3: previous high averages can produce negative +15% thresholds',()=>{
 const next=brokerEstimate(805_000,0,true,[20]);
 assert.ok(next.thresholdPlus15<0);
 assert.equal(brokerEstimate(805_000,-10,true,[20]).after,925_000);
});

test('CSV parser supports quoted semicolons and escaped quotes',()=>{
 assert.deepEqual(parseDelimited('Jugador;PIR\n"Base; A";13\n"El ""Mago""";8'),
 [['Jugador','PIR'],['Base; A','13'],['El "Mago"','8']]);
});
test('PIR must not be silently substituted by EFF',()=>{
 assert.throws(()=>rowsFromTable([['Jugador','EFF'],['Base','12']],Object.values(players)),/PIR/);
 const result=rowsFromTable([['Jugador','PIR','MIN'],['Base','12','18,5']],Object.values(players));
 assert.equal(result[0].player_id,'ba');assert.equal(result[0].pir,12);assert.equal(result[0].played,true);
});
test('market closes without actual scheduled time and when tip-off passes',()=>{
 const season={start_round:5};
 assert.equal(pickUpcoming([{round_number:5,status:'scheduled',starts_at:null}],season).open,false);
 assert.equal(pickUpcoming([{round_number:5,status:'scheduled',starts_at:new Date(Date.now()-60_000).toISOString()}],season).open,false);
 assert.equal(pickUpcoming([{round_number:5,status:'scheduled',starts_at:new Date(Date.now()+60_000).toISOString()}],season).open,true);
});
test('unfinalized previous round blocks next round',()=>{
 const season={start_round:5};
 const f=[{round_number:5,status:'awaiting_votes'}, {round_number:6,status:'scheduled',starts_at:new Date(Date.now()+3600000).toISOString()}];
 assert.equal(pickUpcoming(f,season).open,false);
});
