import test from 'node:test';
import assert from 'node:assert/strict';
import {callupInfo,callupBadge,callupDetail,callupSummary} from '../site/callups.js';
const fixture={id:'fixture-5',round_number:5,status:'scheduled'};
const data={callups:Array.from({length:12},(_,i)=>({fixture_id:fixture.id,player_id:'p'+i}))};
test('before the club saves a callup list everyone is pending, not ruled out',()=>{
 const x=callupInfo({callups:[]},fixture,'p0');
 assert.equal(x.state,'pending');
 assert.match(callupDetail({callups:[]},fixture,'p0'),/Convocatoria pendente/);
 assert.match(callupBadge({callups:[]},fixture,'p0'),/Convocatoria pendente/);
});
test('a saved callup list marks exactly its members and nonmembers',()=>{
 assert.equal(callupInfo(data,fixture,'p0').state,'called');
 assert.equal(callupInfo(data,fixture,'p11').state,'called');
 assert.equal(callupInfo(data,fixture,'p12').state,'out');
 assert.match(callupBadge(data,fixture,'p0'),/Convocado/);
 assert.match(callupDetail(data,fixture,'p12'),/Non convocado/);
 assert.match(callupDetail(data,fixture,'p0'),/non garante minutos/);
 assert.match(callupSummary(data,fixture),/12 xogadores/);
 assert.match(callupSummary(data,fixture),/refresh-callups/);
});
test('callups are fixture-scoped and a later round reverts to pending',()=>{
 assert.equal(callupInfo(data,{id:'fixture-6',round_number:6},'p0').state,'pending');
 assert.equal(callupInfo({callups:[{fixture_id:'fixture-6',player_id:'p0'}]},fixture,'p0').state,'pending');
});
test('a partial unsaved list cannot mistakenly rule players out',()=>{
 assert.equal(callupInfo({callups:[{fixture_id:fixture.id,player_id:'p0'}]},fixture,'p1').state,'pending');
});
test('labels escape untrusted user-supplied round identifiers',()=>{
 const rendered=callupDetail(data,{...fixture,round_number:5},'p0');
 assert.doesNotMatch(rendered,/<script>/);
});
