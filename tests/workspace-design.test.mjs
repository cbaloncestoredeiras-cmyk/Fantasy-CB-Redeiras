import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {navIcon} from '../site/nav-icons.js';

const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');

test('workspace styles are the final CSS layer and use only local resources',()=>{
 const html=read('site/index.html'),css=read('site/workspace.css');
 const styles=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(styles.slice(-3),['workspace.css','ux-v2.css','polish.css']);
 assert.match(css,/--workspace-accent:#33a9db/);
 assert.match(css,/--workspace-bg:#f6f8fb/);
 assert.match(css,/\.sidebar/);
 assert.match(css,/\.mobilebar/);
 assert.match(css,/\.court-visual/);
 assert.doesNotMatch(css,/@import|https?:\/\//i);
 assert.match(html,/name="theme-color" content="#ffffff"/);
});

test('all navigation icons are SVG, decorative and free from external dependencies',()=>{
 for(const route of ['home','market','team','ranking','analytics','calendar','vote','guide','admin','more']){
  const output=navIcon(route);
  assert.match(output,/^<svg aria-hidden="true" focusable="false"/);
  assert.match(output,/<\/svg>$/);
  assert.ok(output.includes('<path')||output.includes('<rect')||output.includes('<circle'));
 }
 assert.doesNotMatch(read('site/nav-icons.js'),/fetch\(|https?:\/\/|<script/i);
});

test('existing market and administration operations remain present in the visual redesign',()=>{
 const pages=read('site/pages.js');
 assert.match(pages,/data-action="save-lineup"/);
 assert.match(pages,/data-action="toggle"/);
 assert.match(pages,/data-page="ranking"/);
 assert.match(pages,/data-page="market"/);
 assert.match(pages,/navIcon\(n\[0\]\)/);
 assert.match(read('site/admin.js'),/fantasy_publish_fixture/);
});
