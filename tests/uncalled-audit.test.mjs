import test from 'node:test';
import assert from 'node:assert/strict';
import {uncalledAuditHtml} from '../site/uncalled-audit.js';

const h=value=>String(value??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const option=(id,label,selected)=>'<option value="'+h(id)+'"'+(id===selected?' selected':'')+'>'+h(label)+'</option>';
const fixtures=[{id:'f5',round_number:5,opponent:'Nigrán',status:'finalized'},{id:'f6',round_number:6,opponent:'Outro',status:'scheduled'}];
test('admin report includes zero picks and saved team names for selected non-called players',()=>{
 const html=uncalledAuditHtml({
  fixture_id:'f5',total_teams:17,
  players:[{player_name:'Iago',pick_count:5,teams:[{name:'Redeiras Power'}]},
    {player_name:'Manuel',pick_count:0,teams:[]},
    {player_name:'Gil',pick_count:1,teams:[{name:'Equipo X'}]}]
 },fixtures,'f5',h,option);
 assert.match(html,/Iago/);
 assert.match(html,/Manuel/);
 assert.match(html,/Equipo X/);
 assert.match(html,/2 xogadores non convocados seleccionados/);
 assert.match(html,/6 seleccións/);
 assert.doesNotMatch(html,/Outro/);
});
test('report refuses unpublished and stale data, escapes adversarial team names',()=>{
 assert.match(uncalledAuditHtml(null,[fixtures[1]],null,h,option),/Aínda non hai xornadas publicadas/);
 assert.match(uncalledAuditHtml({fixture_id:'unrelated'},fixtures,'f5',h,option),/A cargar/);
 const html=uncalledAuditHtml({fixture_id:'f5',players:[{player_name:'<img>',pick_count:1,teams:[{name:'<script>alert(1)</script>'}]}]},fixtures,'f5',h,option);
 assert.ok(html.includes('&lt;img&gt;'));
 assert.ok(!html.includes('<script>'));
});
