import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const stylesheet=src('site/responsive.css');
const base=src('site/style.css');
const html=src('site/index.html');

test('responsive CSS is loaded after base stylesheet and has balanced rules',()=>{
 assert.ok(html.indexOf('style.css')<html.indexOf('responsive.css'));
 assert.equal((stylesheet.match(/\{/g)||[]).length,(stylesheet.match(/\}/g)||[]).length);
 assert.match(stylesheet,/@container market \(max-width:639px\)/);
 assert.match(stylesheet,/@container ranking \(max-width:620px\)/);
 assert.match(stylesheet,/@container stats \(max-width:760px\)/);
 assert.match(stylesheet,/@media\s*\(min-width:640px\)\s*and\s*\(max-width:1099px\)/);
 assert.match(stylesheet,/@media\(max-width:639px\)/);
 assert.doesNotMatch(base,/@media\(max-width:800px\)/);
 assert.match(stylesheet,/env\(safe-area-inset-bottom\)/);
});
test('responsive layout uses intrinsic fluid grids and accessible focus',()=>{
 assert.match(stylesheet,/grid-template-columns:repeat\(auto-fit,minmax\(min\(100%/);
 assert.match(stylesheet,/--tap-target:\s*44px/);
 assert.match(stylesheet,/:focus-visible/);
 assert.match(stylesheet,/prefers-reduced-motion/);
});
const root={innerHTML:''};
globalThis.document={querySelector:selector=>selector==='#root'?root:null};
globalThis.window={FANTASY_CONFIG:{url:'https://example.supabase.co',key:'public-test-value'}};
const views=await import('../site/pages.js');
const {adminView}=await import('../site/admin.js');
views.state.session={user:{id:'test-user',email:'example@club.test'}};
const players=[
 {id:'player-1',name:'Xan López',category:'senior',active:true,positions:['BA','ES'],available_from_round:5},
 {id:'player-2',name:'Mateo García',category:'junior',active:true,positions:['AP','P'],available_from_round:5}
];
const fixture={id:'fixture-5',round_number:5,status:'scheduled',opponent:'Nigrán',starts_at:new Date(Date.now()+86400000).toISOString(),ended_at:null,is_home:true};
views.state.data={
 role:'admin',season:{start_round:5,active:false},fixtures:[fixture],club:{id:'club-1'},
 players,playerMap:Object.fromEntries(players.map(p=>[p.id,p])),photoUrls:{},
 prices:{'player-1':1000000,'player-2':800000},team:null,roster:[],transfers:[],
 leaderboard:[{team_id:'team-1',team_name:'Redeiras',manager_alias:'Xan',position:1,total_points:33}],
 callups:[],eligibleFixtures:[],linkedPlayer:null,stats:[],history:[],
 metrics:{members:2,teams:0,juniors:1,finalized_rounds:0},alias:'Administrador'
};
views.state.draft=[];
test('mobile navigation exposes both voting and administration, including logout',()=>{
 views.state.mobileMenuOpen=true;
 views.shell(views.home());
 assert.match(root.innerHTML,/class="mobilebar"/);
 assert.match(root.innerHTML,/data-action="mobile-more"/);
 assert.match(root.innerHTML,/aria-expanded="true"/);
 assert.match(root.innerHTML,/data-page="vote"/);
 assert.match(root.innerHTML,/data-page="admin"/);
 assert.match(root.innerHTML,/data-action="logout"/);
 assert.match(root.innerHTML,/aria-modal="true"/);
 assert.match(root.innerHTML,/class="skip-link"/);
 views.state.mobileMenuOpen=false;
});
test('participant navigation never exposes admin actions, on desktop or mobile',()=>{
 const previous=views.state.data.role;
 try{
  views.state.data.role='participant';
  views.state.mobileMenuOpen=true;
  views.shell(views.home());
  assert.doesNotMatch(root.innerHTML,/data-page="admin"/);
  assert.match(root.innerHTML,/data-page="vote"/);
  assert.match(root.innerHTML,/data-action="mobile-more"/);
 }finally{
  views.state.data.role=previous;
  views.state.mobileMenuOpen=false;
 }
});
test('market includes responsive player cards and draft shortcut without changing player actions',()=>{
 const output=views.market();
 assert.match(output,/market-tablewrap/);
 assert.match(output,/market-cards/);
 assert.match(output,/market-player-card/);
 assert.match(output,/data-action="toggle"/);
 assert.match(output,/mobile-draft-link/);
 assert.match(output,/id="draft-summary"/);
});
test('ranking offers equivalent table and mobile card views',()=>{
 const output=views.ranking();
 assert.match(output,/ranking-tablewrap/);
 assert.match(output,/ranking-cards/);
 assert.match(output,/Redeiras/);
 assert.match(output,/33/);
});
test('admin stats fields remain available after card adaptation and admin quick links work',()=>{
 const output=adminView();
 assert.match(output,/admin-jumps/);
 for(const id of ['admin-callups','admin-stats','admin-invites','admin-photos'])assert.match(output,new RegExp('id="'+id+'"'));
 for(const attr of ['data-stat-played','data-stat-min','data-stat-pir','data-stat-pts'])assert.match(output,new RegExp(attr));
 assert.match(output,/admin-stats-table/);
});
test('the public site stays invitation-only',()=>{
 views.state.session=null;views.renderAuth();
 assert.match(root.innerHTML,/auth-password/);
 assert.match(root.innerHTML,/Acceso gratuíto e por invitación/);
});
