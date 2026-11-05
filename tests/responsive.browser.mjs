import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {mkdirSync} from 'node:fs';
import {extname,resolve,sep} from 'node:path';
import assert from 'node:assert/strict';

const dist=resolve('dist');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};
const server=createServer(async(req,res)=>{
 const uri=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=resolve(dist,'.'+(uri==='/'?'/index.html':uri));
 if(file!==dist&&!file.startsWith(dist+sep)){res.writeHead(403).end();return;}
 try{const data=await readFile(file);res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'}).end(data);}
 catch{res.writeHead(404).end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port;
const mock="(function mockSDK(){\n const players=[\n  {id:\"a\",name:\"Juan\",category:\"senior\",active:true,available_from_round:5,jersey_number:1},\n  {id:\"b\",name:\"Mateo\",category:\"junior\",active:true,available_from_round:5,jersey_number:2},\n  {id:\"c\",name:\"Mario\",category:\"senior\",active:true,available_from_round:5,jersey_number:3},\n  {id:\"d\",name:\"Adri\",category:\"senior\",active:true,available_from_round:5,jersey_number:4},\n  {id:\"e\",name:\"Yoel\",category:\"senior\",active:true,available_from_round:5,jersey_number:5},\n  {id:\"f\",name:\"Gil\",category:\"junior\",active:true,available_from_round:5,jersey_number:6}\n ];\n const fixture={id:\"fixture-5\",season_id:\"season\",round_number:5,status:\"scheduled\",opponent:\"Nigrán\",starts_at:\"2027-01-15T19:00:00Z\",ended_at:null,is_home:true};\n const rows={\n  club_memberships:[{club_id:\"club\",role:\"admin\",user_id:\"mock-admin\"}],\n  clubs:[{id:\"club\",slug:\"cb-redeiras\",name:\"CB Redeiras\"}],\n  seasons:[{id:\"season\",club_id:\"club\",label:\"2026/27\",start_round:5,active:false}],\n  players,\n  player_positions:[{player_id:\"a\",position:\"BA\"},{player_id:\"b\",position:\"ES\"},{player_id:\"c\",position:\"AP\"},{player_id:\"d\",position:\"P\"},{player_id:\"e\",position:\"AL\"},{player_id:\"f\",position:\"BA\"}],\n  market_prices:players.map((p,i)=>({player_id:p.id,price:750000+i*100000,season_id:\"season\"})),\n  fixtures:[fixture],\n  fantasy_teams:[],\n  profiles:[{display_name:\"Administrador de proba\"}],\n  fixture_callups:[],eligible_voters:[],player_accounts:[],game_stats:[],price_history:[]\n };\n window.supabase={createClient:()=>({\n  auth:{getSession:async()=>({data:{session:{user:{id:\"mock-admin\",email:\"demo@redeiras.test\"}}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},\n  from(table){\n   const query={select(){return this;},eq(){return this;},neq(){return this;},order(){return this;},limit(){return this;},\n    single(){return Promise.resolve({data:(rows[table]||[])[0]||null,error:null});},\n    maybeSingle(){return Promise.resolve({data:(rows[table]||[])[0]||null,error:null});},\n    then(resolve,reject){return Promise.resolve({data:rows[table]||[],error:null}).then(resolve,reject)}\n   };\n   return query;\n  },\n  rpc:async(name)=>({data:name===\"fantasy_admin_metrics\"?{members:2,teams:0,juniors:2,finalized_rounds:0}:name===\"fantasy_leaderboard\"?[{team_id:\"t1\",team_name:\"Redeiras Azuis\",manager_alias:\"Xan\",position:1,total_points:38}]:null,error:null}),\n  storage:{from:()=>({createSignedUrls:async()=>({data:[],error:null})})}\n })};\n})();";
let browser;
mkdirSync('responsive-artifacts',{recursive:true});
const cases=[
 {label:'mobile-320',width:320,height:568},
 {label:'mobile-375',width:375,height:812},
 {label:'mobile-390',width:390,height:844},
 {label:'mobile-430',width:430,height:932},
 {label:'tablet-768',width:768,height:1024},
 {label:'tablet-820',width:820,height:1180},
 {label:'tablet-landscape',width:1024,height:768},
 {label:'desktop-1280',width:1280,height:800},
 {label:'desktop-1440',width:1440,height:900},
 {label:'desktop-1920',width:1920,height:1080}
];
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const size of cases){
  const page=await browser.newPage({viewport:{width:size.width,height:size.height},deviceScaleFactor:1});
  await page.route('**/cdn.jsdelivr.net/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:mock}));
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url,{waitUntil:'load'});
  await page.locator('.layout').waitFor({timeout:9000});
  const mobile=size.width<640;
  assert.equal(await page.locator('.mobilebar').isVisible(),mobile,size.label+' mobile nav');
  assert.equal(await page.locator('.sidebar').isVisible(),!mobile,size.label+' sidebar');
  if(size.width>=640&&size.width<=1099){
   const labels=await page.locator('.sidebar .nav-label').evaluateAll(nodes=>nodes.map(n=>({
    label:n.textContent,
    wrap:getComputedStyle(n).overflowWrap,
    clip:n.scrollWidth>n.clientWidth+2
   })));
   assert.ok(labels.every(x=>x.wrap!=='anywhere'&&!x.clip),size.label+' broken tablet labels '+JSON.stringify(labels));
  }
  if(mobile){
   await page.locator('.mobilebar [data-action="mobile-more"]').click();
   const drawer=page.locator('.mobile-more-sheet');
   assert.ok(await drawer.isVisible(),size.label+' more sheet');
   for(const route of ['vote','admin','calendar'])
    assert.ok(await drawer.locator('[data-page="'+route+'"]').isVisible(),size.label+' missing '+route);
   await drawer.locator('[data-action="close-more"]').click();
  }
  const navigate=async route=>{
   const selector=mobile?'.mobilebar [data-page="'+route+'"]':'.sidebar [data-page="'+route+'"]';
   await page.locator(selector).click();
  };
  await navigate('market');
  assert.ok(await page.locator('.market-results').isVisible(),size.label+' market');
  if(size.width===320)assert.ok(await page.locator('.market-cards').isVisible(),size.label+' cards');
  await page.screenshot({path:'responsive-artifacts/'+size.label+'-market.png',fullPage:true});
  if(mobile){
   await page.locator('.mobilebar [data-action="mobile-more"]').click();
   await page.locator('.mobile-more-sheet [data-page="admin"]').click();
  }else await navigate('admin');
  assert.ok(await page.locator('.admin-stats-table').count(),size.label+' admin stats');
  if(mobile){
   // Opening and closing the menu must not lose unsaved data in the admin editor.
   const minutes=page.locator('[data-stat-min="a"]');
   await minutes.fill('23.5');
   await page.locator('.mobilebar [data-action="mobile-more"]').click();
   await page.locator('.mobile-more-sheet [data-action="close-more"]').click();
   assert.equal(await minutes.inputValue(),'23.5',size.label+' draft admin data was lost');
  }
  await page.screenshot({path:'responsive-artifacts/'+size.label+'-admin.png',fullPage:true});
  // Every application route must remain usable and avoid viewport-level horizontal scrolling.
  const navigateAll=async route=>{
   if(mobile&&['calendar','vote','admin'].includes(route)){
    await page.locator('.mobilebar [data-action="mobile-more"]').click();
    await page.locator('.mobile-more-sheet [data-page="'+route+'"]').click();
   }else await navigate(route);
   await page.locator('#main-content h1').waitFor({timeout:3000});
   const widths=await page.evaluate(()=>({viewport:innerWidth,body:document.body.scrollWidth,html:document.documentElement.scrollWidth}));
   assert.ok(widths.html<=widths.viewport+2,JSON.stringify({case:size.label,route,...widths}));
   assert.ok(await page.locator('.topbar').isVisible(),size.label+' '+route+' topbar');
  };
  for(const route of ['home','team','ranking','calendar','vote','market','admin']){
   await navigateAll(route);
   if(['mobile-390','tablet-820','desktop-1440'].includes(size.label)&&['team','ranking'].includes(route))
    await page.screenshot({path:'responsive-artifacts/'+size.label+'-'+route+'.png',fullPage:true});
  }
  await navigateAll('market');
  const details=page.locator('.market-results [data-player]:visible').first();
  await details.click();
  const modalBounds=await page.locator('.modal').evaluate(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,viewport:innerWidth}));
  assert.ok(modalBounds.left>=-2&&modalBounds.right<=modalBounds.viewport+2,
    JSON.stringify({case:size.label,modal:modalBounds}));
  await page.locator('.modal [data-action="close-modal"]').click();
  assert.equal(await page.locator('.modal').count(),0,size.label+' modal close');
  await page.locator('.topbar [data-action="password-page"]').click();
  assert.ok(await page.locator('#auth-set-password').isVisible(),size.label+' security page');
  const widths=await page.evaluate(()=>({viewport:window.innerWidth,body:document.body.scrollWidth,html:document.documentElement.scrollWidth}));
  assert.ok(widths.html<=widths.viewport+2,JSON.stringify({case:size.label,...widths}));
  assert.deepEqual(errors,[],size.label+' JS exceptions');
  console.log('PASS',size.label,JSON.stringify(widths));
  await page.close();
 }
 for(const size of [{label:'mobile-login',width:390,height:844},{label:'tablet-login',width:820,height:1180},{label:'desktop-login',width:1440,height:900}]){
  const page=await browser.newPage({viewport:{width:size.width,height:size.height},deviceScaleFactor:1});
  await page.route('**/cdn.jsdelivr.net/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:"window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({})}})};"}));
  await page.goto(url,{waitUntil:'load'});
  await page.locator('#auth-password').waitFor({timeout:9000});
  assert.equal(await page.locator('#auth-password-input').count(),1,size.label+' password field');
  const w=await page.evaluate(()=>({viewport:innerWidth,page:document.documentElement.scrollWidth}));
  assert.ok(w.page<=w.viewport+2,size.label+' horizontal overflow');
  await page.screenshot({path:'responsive-artifacts/'+size.label+'.png',fullPage:true});
  console.log('PASS',size.label);
  await page.close();
 }
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
