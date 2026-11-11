import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {courtLineup} from '../site/analytics-view.js';
import {rankingMoves} from '../site/ranking-trends.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const players=[
{id:'a',name:'Álvaro',positions:['BA','ES']},
{id:'b',name:'Adán',positions:['AL','AP']},
{id:'c',name:'Edu',positions:['AP','P']},
{id:'d',name:'Brais',positions:['ES','AL']},
{id:'e',name:'Luca',positions:['AL','ES']}
];
const d={playerMap:Object.fromEntries(players.map(p=>[p.id,p])),prices:Object.fromEntries(players.map((p,i)=>[p.id,900000+i*80000]))};
test('team renders one properly shaped half court with a single hoop and standard marking families',()=>{
 const html=courtLineup(d,players.map(p=>p.id),p=>'<span class="playerlogo">'+p.name+'</span>');
 assert.match(html,/viewBox="0 0 500 467"/);
 assert.match(html,/court-half/);
 assert.equal((html.match(/class="court-rim"/g)||[]).length,1);
 assert.match(html,/class="court-three-point"/);
 assert.match(html,/class="court-backboard"/);
 assert.match(html,/M168 5V198H332V5/);
 assert.match(html,/M5 462H495/);
 assert.equal((html.match(/class="court-player"/g)||[]).length,5);
 for(const p of players)assert.match(html,new RegExp('data-player="'+p.id+'"'));
 assert.match(html,/Preme calquera xogador/);
});
test('app screens are structured around available data, not cosmetic-only placeholders',()=>{
 const pages=read('site/pages.js');
 const app=read('site/app.js');
 const admin=read('site/admin.js');
 assert.match(pages,/dashboard-match-hero/);
 assert.match(pages,/A túa posición/);
 assert.match(pages,/Puntos Fantasy/);
 assert.match(pages,/market-status-strip/);
 assert.ok(pages.indexOf('market-layout')<pages.indexOf('market-tools'));
 assert.match(pages,/team-list-view/);
 assert.match(pages,/ranking-podium/);
 assert.match(pages,/rank-movement/);
 assert.match(app,/dataset\.adminTabPanel/);
 assert.match(app,/dataset\.marketTool/);
 assert.match(admin,/role="tabpanel"/);
 assert.match(admin,/XESTIÓN DO CLUB/);
});
test('mobile UX CSS loads last, with a single basket visual system and compact tabs',()=>{
 const html=read('site/index.html'),css=read('site/ux-v2.css');
 const sheets=[...html.matchAll(/href="([^"]+\.css)"/g)].map(m=>m[1]);
 assert.equal(sheets.at(-1),'ux-v2.css');
 assert.match(css,/aspect-ratio:15\/14/);
 assert.match(css,/\.court-half \.court-rim/);
 assert.match(css,/\.admin-tab-panel\[hidden\]/);
 assert.match(css,/\.market-tool-panel\[hidden\]/);
 assert.match(css,/@media\(max-width:639px\)/);
 assert.doesNotMatch(css,/@import|https?:\/\//);
});
test('score movement is absent before second published round',()=>{
 const rows=[{team_id:'team-a',position:1}];
 const f=[{round_number:5,status:'finalized'},{round_number:6,status:'scheduled'}];
 assert.equal(rankingMoves(f,[{round_number:5,team_id:'team-a',round_points:10}],rows).size,0);
});
