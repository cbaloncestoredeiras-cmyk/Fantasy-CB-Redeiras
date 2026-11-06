import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inflateSync} from 'node:zlib';
import {countdown,deadline,homeExperience,guidePage} from '../site/experience.js';
import {writeInstallIcons} from '../scripts/install-icons.mjs';

test('countdown and market status never promise an unconfirmed time',()=>{
 assert.equal(countdown(null),'Horario pendente');
 assert.equal(countdown(0),'Mercado pechado');
 assert.equal(countdown(1000),'Pecha en 1 min');
 assert.equal(countdown(65*60000),'Pecha en 1 h 5 min');
 assert.equal(countdown(25*3600000),'Pecha en 1 d 1 h');
 const state={data:{season:{active:true,start_round:5},fixtures:[{id:'x5',round_number:5,starts_at:'2026-11-07T19:00:00Z',status:'scheduled'}]}};
 const now=Date.parse('2026-11-07T18:30:00Z');
 assert.equal(deadline(state,now).ms,30*60000);
 assert.equal(deadline(state,now+31*60000).status,'closed');
 assert.equal(deadline({...state,data:{...state.data,season:{active:false,start_round:5}}},now).status,'inactive');
});
test('four-step walkthrough and voluntary alert text do not trigger permission',()=>{
 const fake={guideStep:0,installHelp:true};
 const text=guidePage(fake);
 assert.match(text,/PASO 01 \/ 04/);
 assert.match(text,/Engadir á pantalla de inicio/);
 assert.match(text,/mentres a app está aberta/);
 assert.match(text,/data-action="guide-next"/);
 assert.match(text,/data-action="install-app"/);
 fake.guideStep=3;
 assert.match(guidePage(fake),/PASO 04 \/ 04/);
 assert.match(homeExperience({data:{season:{active:false,start_round:5},fixtures:[]}}),/data-page="guide"/);
});
test('PWA manifest and privacy-preserving offline fallback',()=>{
 const m=JSON.parse(readFileSync(new URL('../site/manifest.webmanifest',import.meta.url),'utf8'));
 assert.equal(m.display,'standalone');
 assert.ok(m.icons.some(i=>i.sizes==='192x192'&&i.type==='image/png'));
 assert.ok(m.icons.some(i=>i.sizes==='512x512'&&i.type==='image/png'));
 const sw=readFileSync(new URL('../site/sw.js',import.meta.url),'utf8');
 assert.match(sw,/u.origin!==self.location.origin/);
 assert.match(sw,/config.js/);
 assert.doesNotMatch(sw,/supabase\.co|auth\.users|game_stats/);
 assert.match(readFileSync(new URL('../site/offline.html',import.meta.url),'utf8'),/Non gardamos estes datos/);
});
test('install icons are PNG with correct pixel dimensions',()=>{
 const dir=mkdtempSync(join(tmpdir(),'fantasy-icon-'));
 try{
  writeInstallIcons(dir);
  for(const size of [180,192,512]){
   const bytes=readFileSync(join(dir,'fantasy-'+size+'.png'));
   assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
   assert.equal(bytes.readUInt32BE(16),size);
   assert.equal(bytes.readUInt32BE(20),size);
   assert.equal(bytes[25],6);
   const length=bytes.readUInt32BE(33);
   assert.equal(bytes.subarray(37,41).toString(),'IDAT');
   assert.equal(inflateSync(bytes.subarray(41,41+length)).length,size*(size*4+1));
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});
