import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('visual polish is installed after the workspace and UX layers without external dependencies',()=>{
 const html=read('site/index.html');
 const order=[...html.matchAll(/rel="stylesheet" href="([^"]+)"/g)].map(x=>x[1]);
 assert.deepEqual(order.slice(-3),['workspace.css','ux-v2.css','polish.css']);
 const css=read('site/polish.css');
 assert.match(css,/\.player-profile-hero/);
 assert.match(css,/\.dashboard-performance-score/);
 assert.match(css,/\.court-player-best/);
 assert.match(css,/\.ranking-podium/);
 assert.match(css,/\.market-filter-chip/);
 assert.match(css,/\.price-chart polyline/);
 assert.match(css,/\.callup-badge::before/);
 assert.match(css,/\.mobilebar button\.active/);
 assert.match(css,/\.btn\.is-working/);
 assert.match(css,/prefers-reduced-motion/);
 assert.doesNotMatch(css,/@import|https?:\/\//);
});
test('market sort and quick filters preserve purchase and comparison controls',()=>{
 const pages=read('site/pages.js'),app=read('site/app.js');
 for(const value of ['outside','inside','junior','called','form-desc','popularity-desc']){
  assert.ok(pages.includes(value),value);
 }
 assert.match(pages,/id="market-sort"/);
 assert.match(pages,/data-market-filter/);
 assert.match(pages,/data-action="toggle"/);
 assert.match(pages,/data-action="save-lineup"/);
 assert.match(app,/const marketFilter=e\.target\.closest/);
 assert.match(app,/if\(e\.target\.id==='market-sort'\)/);
 assert.match(app,/originalPlayerUsage\(d\.transferStatus/);
});
test('individual player profile uses existing stored portraits and published statistics',()=>{
 const app=read('site/app.js');
 assert.match(app,/player-profile-hero/);
 assert.match(app,/playerAvatar\(p,'profile-portrait'\)/);
 assert.match(app,/playerForm\(p\.id,state\.data\.fixtures,state\.data\.stats\)/);
 assert.match(app,/priceHistorySection\(state\.data,id\)/);
 assert.match(read('site/analytics-view.js'),/court-player-best/);
});
test('server transfer limit is based on distinct original starters and has per-round persistence',()=>{
 const migration=read('supabase/migrations/20261111120000_transfer_original_players_per_round.sql');
 assert.match(migration,/create table if not exists private\.fantasy_round_originals/);
 assert.match(migration,/primary key\(team_id,round_number\)/);
 assert.match(migration,/array_agg\(distinct u\.id\)/);
 assert.match(migration,/cardinality\(v_sold_after\)>s\.max_transfers/);
 assert.match(migration,/for update/);
 assert.match(migration,/user_id=auth\.uid\(\)/);
 assert.match(migration,/private\.is_member\(s\.club_id\)/);
 assert.match(migration,/grant execute on function public\.fantasy_transfer_status\(uuid\) to authenticated/);
 assert.doesNotMatch(migration,/v_used\+v_removed/);
});
