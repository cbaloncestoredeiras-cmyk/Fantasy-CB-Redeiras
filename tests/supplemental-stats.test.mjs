import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rowsFromTable} from '../site/logic.js';
import {playerSeasonStats} from '../site/analytics.js';
import {playerAdvancedPanel} from '../site/analytics-view.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Basketball Stats Assistant CSV imports REB and AST, including measured zeros, and flags unmatched names',()=>{
 const nameList=['Brais','Iván','Juan','Yoel','Mario','Adán','Luca','Álex','Álvaro','Diego','Adri','Edu'];
 const players=nameList.map((name,i)=>({id:String(i+1),name}));
 const vals=[
  ['Brais','3:21',0,0,1],['Ivan','3:16',3,1,0],['Juan','35:40',8,10,1],
  ['Yoel','16:20',0,1,2],['Mario','36:26',5,6,1],['Dunkos','6:15',2,0,0],
  ['Luca','1:33',-1,1,2],['Alex','10:15',0,1,0],['Alvaro','22:53',4,2,3],
  ['Pola','15:55',-3,3,0],['Diego','20:31',1,0,1],['Adri','27:29',9,9,2]
 ];
 // The club confirmed Pola (#30) is Edu Pola, so this alias is now safe.
 const rows=rowsFromTable([
  ['Jugador','PIR','MIN','REB','AST'],
  ...vals.map(([name,min,pir,reb,ast])=>[name,pir,min,reb,ast])
 ],players);
 const matched=rows.filter(x=>x.player_id);
 assert.equal(matched.length,12);
 assert.equal(rows.find(x=>x.name==='Dunkos').player_id,players.find(x=>x.name==='Adán').id);
 assert.equal(rows.find(x=>x.name==='Pola').player_id,players.find(x=>x.name==='Edu').id);
 assert.equal(matched.reduce((s,x)=>s+x.rebounds,0),34);
 assert.equal(matched.reduce((s,x)=>s+x.assists,0),13);
 assert.equal(rows.reduce((s,x)=>s+x.rebounds,0),34);
 const zero=rows.find(x=>x.name==='Brais');
 assert.equal(zero.rebounds,0);
 assert.equal(zero.minutes,3.35);
 assert.equal(zero.rebounds_recorded,true);
 assert.equal(zero.assists_recorded,true);
});

test('missing CSV REB/AST columns or blank cells stay unknown, never fabricated zero',()=>{
 const players=[{id:'1',name:'Brais'}];
 const absent=rowsFromTable([['Jugador','VAL','MIN'],['Brais','-3','3,2']],players)[0];
 assert.equal(absent.rebounds,null);
 assert.equal(absent.assists,null);
 assert.equal(absent.rebounds_recorded,false);
 assert.equal(absent.assists_recorded,false);
 const blank=rowsFromTable([['Jugador','VAL','MIN','REB','AST'],['Brais','-3','3,2','','']],players)[0];
 assert.equal(blank.rebounds_recorded,false);
 assert.equal(blank.assists_recorded,false);
 assert.throws(()=>rowsFromTable([['Jugador','VAL','MIN','REB'],['Brais','-3','3,2','-1']],players),/REB/);
 assert.throws(()=>rowsFromTable([['Jugador','VAL','MIN','REB'],['Brais','-3','3,2','2.3']],players),/REB/);
});

test('profile shows per-game missing data distinctly and averages only recorded REB/AST',()=>{
 const data={
  fixtures:[{id:'f5',round_number:5,status:'finalized',supplemental_stats_note:'Vídeo interrompido: datos parciais'},
            {id:'f6',round_number:6,status:'finalized'}],
  stats:[
   {fixture_id:'f5',player_id:'p',played:true,fantasy_points:4,pir:3,points:4,
    rebounds:10,rebounds_recorded:true,assists:0,assists_recorded:true,minutes:22,vote_bonus:1},
   {fixture_id:'f6',player_id:'p',played:true,fantasy_points:12,pir:11,points:15,
    rebounds:0,rebounds_recorded:false,assists:0,assists_recorded:false,minutes:27,vote_bonus:1}
  ]
 };
 const s=playerSeasonStats(data,'p');
 assert.equal(s.played,2);
 assert.equal(s.averages.fantasy_points,8);
 assert.equal(s.averages.rebounds,10);
 assert.equal(s.averages.assists,0);
 assert.equal(s.observedGames.rebounds,1);
 assert.equal(s.observedGames.assists,1);
 const html=playerAdvancedPanel(data,'p');
 assert.match(html,/Vídeo interrompido/);
 assert.match(html,/parcial/);
 assert.match(html,/—/);
 assert.match(html,/non alteran PIR/i);
});
test('admin imports REB/AST after publishing via separate RPC; published Fantasy and price formulas remain untouched',()=>{
 const admin=read('site/admin.js'),app=read('site/app.js'),migration=read('supabase/migrations/20261111134000_optional_rebounds_assists_round5.sql');
 assert.match(admin,/data-stat-reb/);
 assert.match(admin,/data-stat-ast/);
 assert.match(admin,/save-observed-stats/);
 assert.match(admin,/fantasy_save_boxscore/);
 assert.match(admin,/data-action="save-stats"/);
 assert.match(app,/'save-observed-stats'/);
 assert.match(migration,/public\.fantasy_save_observed_stats/);
 assert.match(migration,/if auth\.uid\(\) is null or v_club is null or not private\.is_admin\(v_club\)/);
 const supplementary=migration.slice(migration.indexOf('create or replace function public.fantasy_save_observed_stats'),
  migration.indexOf('-- Partial X5 footage'));
 assert.doesNotMatch(supplementary,/fantasy_persist_fixture_preview|next_price|team_round_scores|price_history|fantasy_points\s*=/i);
 assert.match(migration,/NON asignada a Edu/i); // historical partial source note
});
