import test from 'node:test';
import assert from 'node:assert/strict';
import {voteTrackingHtml} from '../site/vote-tracking.js';

const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const d=value=>String(value).slice(0,16);
const fixture={id:'fixture-5',ended_at:'2026-11-07T21:00:00+00:00'};
const tracking={
 fixture_id:fixture.id,eligible:10,voted:2,pending:8,callups:12,
 voters:[
  {name:'Juan',voted:true},
  {name:'Álvaro',voted:true},
  {name:'Adri',voted:false}
 ]
};

test('admin sees counts, progress and names of pending voters, not picks',()=>{
 const out=voteTrackingHtml(tracking,fixture,h,d);
 assert.match(out,/Votaron/);
 assert.match(out,/Pendentes/);
 assert.match(out,/20 %/);
 assert.match(out,/value="2" max="10"/);
 assert.match(out,/Juan/);
 assert.match(out,/Adri/);
 assert.match(out,/Pendente/);
 assert.match(out,/2 convocados sen conta habilitada/);
 assert.doesNotMatch(out,/recipient_player_id|voter_user_id|@|A quen votou/i);
});
test('wrong fixture never displays stale vote tracking',()=>{
 const out=voteTrackingHtml(tracking,{id:'fixture-6',ended_at:null},h,d);
 assert.match(out,/A cargar/);
 assert.doesNotMatch(out,/Juan|20 %/);
});
test('returns safe error and manual refresh control',()=>{
 const out=voteTrackingHtml({fixture_id:fixture.id,error:true},fixture,h,d);
 assert.match(out,/Actualizar votos/);
 assert.match(out,/Non foi posible cargar/);
});
test('escape player names to prevent markup injection',()=>{
 const out=voteTrackingHtml({...tracking,voters:[{name:'<img src=x onerror=alert(1)>',voted:false}]},fixture,h,d);
 assert.ok(out.includes('&lt;img src=x'));
 assert.ok(!out.includes('<img src=x'));
});
test('empty eligible voters is explicit and does not divide by zero',()=>{
 const out=voteTrackingHtml({fixture_id:fixture.id,eligible:0,voted:0,callups:0,voters:[]},fixture,h,d);
 assert.match(out,/0 %/);
 assert.match(out,/Aínda non hai contas habilitadas/);
});

test('coach vote is tracked separately and not counted among player ballots',()=>{
 const out=voteTrackingHtml({...tracking,coach:{enabled:true,voted:false}},fixture,h,d);
 assert.match(out,/Voto do adestrador/);
 assert.match(out,/Pendente/);
 assert.match(out,/20 %/);
 const voted=voteTrackingHtml({...tracking,coach:{enabled:true,voted:true}},fixture,h,d);
 assert.match(voted,/Voto do adestrador/);
 assert.match(voted,/Votou/);
 assert.match(voted,/20 %/);
 assert.doesNotMatch(voted,/emiliocarballo02|@/);
});

test('shows early closure only at 100% with finished stats and coach voted',()=>{
 const f={...fixture,stats_finalized_at:'2026-11-09T11:32:51Z',team_won:false};
 const fixedNow=Date.now;
 try{
   Date.now=()=>Date.parse('2026-11-09T12:00:00Z');
   let html=voteTrackingHtml({...tracking,eligible:10,voted:10,coach:{enabled:true,voted:true}},f,h,d);
   assert.match(html,/close-votes-early/);
   html=voteTrackingHtml({...tracking,eligible:10,voted:10,coach:{enabled:true,voted:false}},f,h,d);
   assert.doesNotMatch(html,/close-votes-early/);
   html=voteTrackingHtml({...tracking,eligible:10,voted:9,coach:{enabled:true,voted:true}},f,h,d);
   assert.doesNotMatch(html,/close-votes-early/);
   html=voteTrackingHtml({...tracking,eligible:10,voted:10,coach:{enabled:true,voted:true}},{...f,stats_finalized_at:null},h,d);
   assert.doesNotMatch(html,/close-votes-early/);
 }finally{Date.now=fixedNow;}
});
test('closed votes show closed status and no closure button',()=>{
 const f={...fixture,votes_finalized_at:'2026-11-09T12:00:00Z',stats_finalized_at:'2026-11-09T11:32:00Z',team_won:false};
 const html=voteTrackingHtml({...tracking,eligible:10,voted:10,coach:{enabled:true,voted:true}},f,h,d);
 assert.match(html,/Votación pechada/);
 assert.doesNotMatch(html,/close-votes-early/);
});
