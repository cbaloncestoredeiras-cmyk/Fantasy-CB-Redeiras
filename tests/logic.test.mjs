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
test('cumulative-average broker can RISE despite a negative second match',()=>{
  const first=brokerEstimate(800_000,30,true);
  assert.equal(first.after,920_000); // +15% maximum
  const second=brokerEstimate(first.after,-5,true,[30]);
  assert.equal(second.average,12.5);
  assert.equal(second.after,1_055_000); // rises ~14.7% even after -5
  assert.ok(second.thresholdPlus15<0); // sufficiently strong opening performance
});
test('Redeiras broker: negative cheap score can rise, top-priced player needs positive',()=>{
 const iago=700_000,juan=2_250_000;
 assert.equal(brokerEstimate(iago,-1,true).after,710_000);
 assert.equal(brokerEstimate(iago,-2,true).after,660_000);
 assert.equal(brokerEstimate(iago,1,true).after,805_000);
 assert.equal(brokerEstimate(1_200_000,2,true).after,1_260_000);
 assert.equal(brokerEstimate(1_500_000,3,true).after,1_550_000);
 assert.equal(brokerEstimate(juan,3,true).after,2_150_000);
 assert.equal(brokerEstimate(juan,5,true).after,juan);
 assert.ok(brokerEstimate(juan,-1,true).after<juan);
 assert.equal(brokerEstimate(iago,0,false).after,iago);
 assert.equal(brokerEstimate(iago,-1,true).thresholdMinus15,null);
 assert.equal(brokerEstimate(juan,5,true).expected,5);
});
test('broker pacing slows premium price declines and cumulative averages still matter',()=>{
 const high=brokerEstimate(2_250_000,3,true);
 assert.ok(high.after>=2_100_000);
 const first=brokerEstimate(700_000,8,true);
 const second=brokerEstimate(first.after,-2,true,[8]);
 assert.ok(second.after>first.after);
 assert.equal(second.playedGames,2);
});
test('cumulative average excludes missed matches and zero-score appearances do count',()=>{
  const current=920_000, prior=[30];
  assert.equal(brokerEstimate(current,-50,false,prior).after,current);
  assert.equal(brokerEstimate(current,0,true,prior).average,15);
  assert.equal(brokerEstimate(current,0,true,prior).playedGames,2);
});
test('opening game negative score can decrease price; average drives future changes',()=>{
  const current=1_000_000;
  const first=brokerEstimate(current,-5,true);
  assert.equal(first.after,850_000);
  const second=brokerEstimate(first.after,30,true,[-5]);
  assert.ok(second.after>first.after);
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
