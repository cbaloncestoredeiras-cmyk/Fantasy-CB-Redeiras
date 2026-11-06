import test from 'node:test';
import assert from 'node:assert/strict';
import {availabilityBadge,availabilityLabel,availabilityWarning,unavailablePlayers} from '../site/availability.js';
import {validateLineup,transferPlan} from '../site/logic.js';
const p={a:{id:'a',name:'Manuel',positions:['AL','AP'],availability_status:'injured',availability_weeks:3},
b:{id:'b',name:'Juan',positions:['BA']},c:{id:'c',name:'Adri',positions:['P']},d:{id:'d',name:'Mario',positions:['AP']},e:{id:'e',name:'Yoel',positions:['ES']},f:{id:'f',name:'Iago',positions:['AL']}};
const price=Object.fromEntries(Object.keys(p).map(id=>[id,800000]));
test('exactly five distinct selected players required, injury occupies a roster spot',()=>{
 assert.equal(validateLineup(['a','b','c','d','e'],p,price).valid,true);
 assert.equal(validateLineup(['a','b','c','d'],p,price).valid,false);
 assert.equal(validateLineup([],p,price).valid,false);
 assert.equal(validateLineup(['a','b','c','d','d'],p,price).valid,false);
});
test('injury is informative; substitution still counts as one transfer',()=>{
 assert.match(availabilityLabel(p.a),/3 semanas/);
 assert.match(availabilityBadge(p.a),/Lesionado/);
 assert.match(availabilityWarning(['a','b'],p),/non suma puntos Fantasy/);
 assert.equal(unavailablePlayers(['a','b'],p).length,1);
 assert.equal(availabilityWarning(['b'],p),'');
 assert.equal(transferPlan(['a','b','c','d','e'],['f','b','c','d','e'],0,price).changes,1);
});
test('player names are escaped in the public warning',()=>{
 const html=availabilityWarning(['z'],{z:{id:'z',name:'<img src=x onerror=alert(1)>',availability_status:'injured'}});
 assert.doesNotMatch(html,/<img/);
 assert.match(html,/&lt;img/);
});
