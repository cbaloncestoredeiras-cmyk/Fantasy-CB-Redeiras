import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rowsFromTable} from '../site/logic.js';
import {playerSeasonStats} from '../site/analytics.js';
import {boxHeaders,boxRow,hasInformative,boxDraft} from '../site/boxscore-admin.js';
import {boxPercentage} from '../site/boxscore.js';

test('full BSA boxscore is read with PF, PFD, SR, attempts and signed EFF/+/-',()=>{
 const hdr=['Jugador','MIN','VAL','PTS','FGM','FGA','2PM','2PA','3PM','3PA','FTM','FTA','OREB','DREB','REB','AST','TOV','STL','BLK','SR','PF','PFD','EFF','+/-'];
 const row=['Pola','15:55',-6,2,1,10,1,7,0,3,0,0,0,3,3,0,0,2,1,0,5,0,-1,-13];
 const parsed=rowsFromTable([hdr,row],[{id:'edu',name:'Edu'}])[0];
 assert.equal(parsed.player_id,'edu');
 assert.equal(parsed.minutes,15.92);
 assert.equal(parsed.pir,-6);
 assert.equal(parsed.fg_attempted,10);
 assert.equal(parsed.two_attempted,7);
 assert.equal(parsed.three_attempted,3);
 assert.equal(parsed.fouls,5);
 assert.equal(parsed.fouls_drawn,0);
 assert.equal(parsed.shots_rejected,0);
 assert.equal(parsed.eff,-1);
 assert.equal(parsed.plus_minus,-13);
 assert.equal(parsed.steals,2);
 assert.equal(parsed.steals_recorded,true);
 assert.equal(parsed.turnovers_recorded,true);
 assert.equal(parsed.blocks_recorded,true);
});

test('observed zero differs from unknown; percentages use actual attempts',()=>{
 const players=[{id:'a',name:'Adri'}];
 const noShots=rowsFromTable([['Jugador','VAL','MIN','STL'],['Adri',8,23,'']],players)[0];
 assert.equal(noShots.fg_made,null);
 assert.equal(noShots.steals,null);
 assert.equal(noShots.steals_recorded,false);
 assert.equal(hasInformative(noShots),false);
 const zero=rowsFromTable([['Jugador','VAL','MIN','STL'],['Adri',8,23,0]],players)[0];
 assert.equal(zero.steals,0);assert.equal(zero.steals_recorded,true);assert.equal(hasInformative(zero),true);
 assert.equal(boxPercentage(2,8),25);assert.equal(boxPercentage(0,4),0);
 assert.equal(boxPercentage(null,8),null);assert.equal(boxPercentage(2,0),null);
 assert.throws(()=>rowsFromTable([['Jugador','VAL','MIN','PF'],['Adri',8,23,-1]],players),/PF/);
 assert.throws(()=>rowsFromTable([['Jugador','VAL','MIN','2PM'],['Adri',8,23,2.5]],players),/2PM/);
});

test('shot percentage is weighted by attempts across published games only',()=>{
 const d={fixtures:[{id:'f5',round_number:5,status:'finalized'},
 {id:'f6',round_number:6,status:'finalized'},{id:'f7',round_number:7,status:'scheduled'}],
 stats:[
 {fixture_id:'f5',player_id:'a',played:true,fantasy_points:10,pir:9,points:9,minutes:35,
  two_made:2,two_attempted:8,ft_made:3,ft_attempted:5,steals:5,steals_recorded:true},
 {fixture_id:'f6',player_id:'a',played:true,fantasy_points:12,pir:11,points:14,minutes:31,
  two_made:5,two_attempted:10,ft_made:null,ft_attempted:null,steals:0,steals_recorded:false},
 {fixture_id:'f7',player_id:'a',played:true,fantasy_points:100,pir:99,points:100,minutes:39,
  two_made:9,two_attempted:10}
 ]};
 const p=playerSeasonStats(d,'a');
 assert.equal(p.averages.two_pct,38.89);
 assert.equal(p.observedGames.two_pct,2);
 assert.equal(p.averages.ft_pct,60);
 assert.equal(p.observedGames.ft_pct,1);
 assert.equal(p.averages.steals,5);
 assert.equal(p.observedGames.steals,1);
 assert.equal(p.played,2);
});

test('admin renders all optional fields with sign and does not treat blanks as zero',()=>{
 const h=x=>String(x);
 const html=boxHeaders(h)+boxRow({id:'p',name:'Juan'},{fg_made:3,fg_attempted:7,
  plus_minus:-11,steals:5,steals_recorded:true},h,x=>String(x));
 assert.match(html,/data-stat-fg_made="p"/);
 assert.match(html,/data-stat-plus_minus="p"/);
 assert.match(html,/FG%/);
 assert.match(html,/42.86 %/);
 assert.match(html,/value="-11"/);
 assert.match(html,/value="5"/);
 const empty=boxDraft({id:'p'},()=>null);
 assert.equal(empty.steals_recorded,false);
});

test('new SQL RPC affects only supplementary columns and keeps official totals untouched',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261111170000_full_boxscore_informative_j5.sql',import.meta.url),'utf8');
 const rpc=sql.slice(sql.indexOf('create or replace function public.fantasy_save_boxscore'),sql.indexOf('revoke all on function'));
 assert.match(rpc,/private\.is_admin\(v_club\)/);
 assert.doesNotMatch(rpc,/fantasy_points\s*=|pir\s*=|price_history|team_round_scores|market_prices/i);
 assert.match(sql,/\('Juan',3,7,3,6,0,1,3,5/);
 assert.match(sql,/\('Adán',1,3,0,2,1,1,4,4/);
 assert.match(sql,/\('Adri',2,8,2,8,0,0,2,4/);
});
