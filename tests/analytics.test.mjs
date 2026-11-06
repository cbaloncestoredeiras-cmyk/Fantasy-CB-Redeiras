import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {finalizedPlayerRows,playerSeasonStats,leaderboardLeaders,seasonRecords,popularityRows} from '../site/analytics.js';
import {playerAdvancedPanel,courtLineup,popularityPanel,analyticsPage,recordsPanel} from '../site/analytics-view.js';
import {decodeVapidKey,publicPushKey,remotePushSupported} from '../site/push.js';

const fixture=(round,status='finalized')=>({id:'f'+round,round_number:round,status});
const players=[
 {id:'a',name:'Juan',positions:['BA'],category:'senior'},
 {id:'b',name:'Mario',positions:['AP'],category:'senior'},
 {id:'c',name:'Adri',positions:['P'],category:'senior'},
 {id:'d',name:'Yoel',positions:['ES'],category:'senior'},
 {id:'e',name:'Iago',positions:['AL'],category:'senior'}
];
const scores=(round,player_id,score,extra={})=>({fixture_id:'f'+round,player_id,played:true,fantasy_points:score,points:score,rebounds:3,assists:1,pir:score-1,minutes:23,steals:0,blocks:1,turnovers:2,vote_bonus:0,...extra});
const data={
 fixtures:[fixture(5),fixture(6),fixture(7,'scheduled')],
 players,playerMap:Object.fromEntries(players.map(p=>[p.id,p])),
 stats:[scores(5,'a',10),scores(6,'a',20),scores(7,'a',100),scores(5,'b',15),scores(6,'b',12),
 scores(5,'c',0,{played:false}),scores(6,'c',-1)],
 weeklyRanking:[{round_number:5,position:1,team_id:'t1',team_name:'Redeiras 1',round_points:80},
 {round_number:5,position:2,team_id:'t2',team_name:'Redeiras 2',round_points:60},
 {round_number:6,position:1,team_id:'t2',team_name:'Redeiras 2',round_points:90},
 {round_number:6,position:2,team_id:'t1',team_name:'Redeiras 1',round_points:40},
 {round_number:7,position:1,team_id:'t1',team_name:'Redeiras 1',round_points:2000}],
 popularity:[],photoUrls:{},prices:{a:1000000,b:1250000}
};
test('advanced player averages ignore unpublished scores and unplayed games',()=>{
 const stats=finalizedPlayerRows(data,'a');
 assert.deepEqual(stats.map(x=>x.round),[5,6]);
 const m=playerSeasonStats(data,'a');
 assert.equal(m.played,2);
 assert.equal(m.averages.fantasy_points,15);
 assert.equal(m.totals.points,30);
 assert.equal(m.best,20);
 assert.equal(playerSeasonStats(data,'c').played,1);
 assert.equal(playerSeasonStats(data,'unknown').averages.fantasy_points,null);
 assert.equal(leaderboardLeaders(data)[0].player.id,'a');
});
test('record statistics rely only on finalized weekly score snapshots',()=>{
 const r=seasonRecords(data);
 assert.equal(r.completed,2);
 assert.equal(r.bestRound.round_points,90);
 assert.equal(r.topPlayer.player.id,'a');
 assert.equal(r.mostWins.wins,1);
 assert.equal(r.comeback.places,1);
 assert.equal(r.comeback.teamName,'Redeiras 2');
 assert.doesNotMatch(recordsPanel(data),/2\.000/);
 const fresh={...data,fixtures:data.fixtures.map(x=>({...x,status:'scheduled'}))};
 assert.match(recordsPanel(fresh),/Aínda non hai xornadas publicadas/);
});
test('court renders all five unique buttons and handles preview without editing real team',()=>{
 const d={...data};
 const ids=players.map(p=>p.id),snapshot=JSON.stringify(d);
 const html=courtLineup(d,ids,p=>'<span>'+p.name+'</span>');
 assert.equal((html.match(/class="court-player"/g)||[]).length,5);
 assert.match(html,/role="group"/);
 assert.match(html,/data-player="a"/);
 assert.match(html,/pista de baloncesto/);
 assert.match(courtLineup(d,ids.slice(0,3),p=>'<span>'+p.name+'</span>'),/3 de 5/);
 assert.equal(JSON.stringify(d),snapshot);
});
test('profile and dashboard only show completed per-game statistics',()=>{
 const profile=playerAdvancedPanel(data,'a');
 assert.match(profile,/Estatísticas avanzadas/);
 assert.match(profile,/X6/);
 assert.doesNotMatch(profile,/X7/);
 assert.match(profile,/PIR/);
 const panel=analyticsPage(data,'rebounds',p=>'<b>'+p.name+'</b>');
 assert.match(panel,/Ordenar por/);
 assert.match(panel,/Juan/);
 assert.match(playerAdvancedPanel(data,'unknown'),/Sen partidos Fantasy publicados/);
});
test('popularity masks values under 3 and contains no other manager identities',()=>{
 const d={...data,popularity:[
  {player_id:'a',pick_count:5,total_teams:7,pick_percent:71.4},
  {player_id:'b',pick_count:null,total_teams:7,pick_percent:null}
 ]};
 const rows=popularityRows(d);
 assert.equal(rows.length,2);assert.equal(rows[0].picks,5);
 const html=popularityPanel(d);
 assert.match(html,/71,4/);
 assert.match(html,/Poucas eleccións/);
 assert.doesNotMatch(html,/Redeiras 1|Redeiras 2/);
 assert.match(popularityPanel(data),/non se mostran quintetos individuais/i);
});
test('push module refuses invalid VAPID public keys without requesting browser permissions',()=>{
 assert.equal(publicPushKey(),'');
 assert.equal(remotePushSupported(),false);
 assert.throws(()=>decodeVapidKey('secret-private-key'),/incorrecta/);
 const key=Buffer.alloc(65,5).toString('base64url');
 assert.equal(decodeVapidKey(key).length,65);
});
test('migration keeps subscriptions owner-only and claims service-role only',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261106010000_v14_popularity_push.sql',import.meta.url),'utf8');
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/USING \(user_id=\(select auth.uid\(\)\)\)/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public.fantasy_push_claim\(integer\) TO service_role/);
 assert.match(sql,/f.status='finalized'/);
 assert.match(sql,/v_total<5 THEN RETURN/);
 assert.match(sql,/count\(l.team_id\)>=3/);
 assert.match(sql,/private.push_dispatches/);
 const sender=readFileSync(new URL('../supabase/functions/fantasy-push-send/index.ts',import.meta.url),'utf8');
 assert.match(sender,/FANTASY_PUSH_CRON_SECRET/);
 assert.match(sender,/sendNotification/);
 assert.doesNotMatch(sender,/console\.log\([^)]*endpoint/);
});
