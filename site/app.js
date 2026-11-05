import {state,renderAuth,renderForbidden,securityPage,shell,home,market,marketTable,team,ranking,calendar,voting,toast,rpc,current,player,prices,h,dateText,panel,pageHeader,admin,euroShort,playerAvatar} from './pages.js';
import {adminView,adminAction,handleStatsFile} from './admin.js';
import {validateLineup,transferPlan,brokerEstimate,pts} from './logic.js';

const root=document.querySelector('#root');
function present(){
 if(!state.session){renderAuth();return;}
 if(!state.data){renderForbidden();return;}
 const pages={home,market,team,ranking,calendar,vote:voting,admin:adminView,security:securityPage};
 const content=(pages[state.page]||home)();
 shell(content);
}
function missingDb(error){
 root.innerHTML='<div class="auth-page"><div class="auth-art"><h1>Acceso temporalmente non dispoñible.</h1><p>A aplicación está a configurarse. Non se modificou ningunha aliñación.</p></div><div class="auth-form"><div class="panel"><h2>Erro de conexión</h2><p>'+h(error.message||String(error))+'</p><button class="btn secondary" data-action="retry">Reintentar</button><button class="btn outline" data-action="logout" style="margin-top:10px">Pechar sesión</button></div></div></div>';
}
async function load(){
 const c=state.client,u=state.session.user;
 const member=await c.from('club_memberships').select('club_id,role').eq('user_id',u.id).limit(1).maybeSingle();
 if(member.error)throw member.error;
 if(!member.data){state.data=null;present();return;}
 const role=member.data.role,clubId=member.data.club_id;
 const clubR=await c.from('clubs').select('*').eq('id',clubId).single();if(clubR.error)throw clubR.error;
 const seasonR=await c.from('seasons').select('*').eq('club_id',clubId).order('created_at',{ascending:false}).limit(1).single();
 if(seasonR.error)throw seasonR.error;
 const season=seasonR.data;
 const toPromise=(q)=>q.then(r=>{if(r.error)throw r.error;return r.data||[]});
 const [players,positions,priceRows,fixtures,teams,alias,callups,eligible,voterAccount,stats,history]=await Promise.all([
 toPromise(c.from('players').select('id,name,category,active,jersey_number,available_from_round,photo_path').eq('club_id',clubId).eq('active',true).order('name')),
 toPromise(c.from('player_positions').select('player_id,position')),
 toPromise(c.from('market_prices').select('player_id,price').eq('season_id',season.id)),
 toPromise(c.from('fixtures').select('*').eq('season_id',season.id).order('round_number')),
 toPromise(c.from('fantasy_teams').select('*').eq('season_id',season.id).eq('user_id',u.id).limit(1)),
 toPromise(c.from('profiles').select('display_name').eq('id',u.id).limit(1)),
 toPromise(c.from('fixture_callups').select('fixture_id,player_id')),
 toPromise(c.from('eligible_voters').select('fixture_id').eq('user_id',u.id)),
 toPromise(c.from('player_accounts').select('player_id').eq('user_id',u.id)),
 toPromise(c.from('game_stats').select('*')),
 toPromise(c.from('price_history').select('player_id,round_number,price_before,price_after,accumulated_average,played_games').eq('season_id',season.id).order('round_number',{ascending:false}))
 ]);
 const roster=teams.length?await toPromise(c.from('team_rosters').select('player_id').eq('team_id',teams[0].id)):[];
 const transfers=teams.length?await toPromise(c.from('transfers').select('*').eq('team_id',teams[0].id).order('executed_at',{ascending:true})):[];
 const rankR=await c.rpc('fantasy_leaderboard',{p_season:season.id});
 if(rankR.error)throw rankR.error;
 const metricsR=role==='admin'?await c.rpc('fantasy_admin_metrics',{p_club:clubId}):{data:null,error:null};
 if(metricsR.error)throw metricsR.error;
 const photoUrls={};
 const withPhotos=players.filter(p=>p.photo_path);
 if(withPhotos.length){
   const paths=withPhotos.map(p=>p.photo_path);
   const signed=await c.storage.from('player-photos').createSignedUrls(paths,21600);
   if(!signed.error&&signed.data){
     withPhotos.forEach((p,i)=>{if(signed.data[i]?.signedUrl)photoUrls[p.id]=signed.data[i].signedUrl;});
   }else console.warn('Non se puideron cargar as fotos dos xogadores:',signed.error?.message);
 }
 const priceMap=Object.fromEntries(priceRows.map(p=>[p.player_id,p.price]));
 const positionMap={};for(const p of positions){if(!positionMap[p.player_id])positionMap[p.player_id]=[];positionMap[p.player_id].push(p.position);}
 const fullPlayers=players.map(p=>({...p,positions:positionMap[p.id]||[]}));
 const playerMap=Object.fromEntries(fullPlayers.map(p=>[p.id,p]));
 state.data={role,club:clubR.data,season,players:fullPlayers,playerMap,prices:priceMap,photoUrls,fixtures,
 team:teams[0]||null,roster:roster.map(r=>r.player_id),transfers,leaderboard:rankR.data||[],
 alias:alias[0]?.display_name||'Redeirista',callups,eligibleFixtures:eligible.map(x=>x.fixture_id),
 linkedPlayer:voterAccount[0]?.player_id||null,stats,history,metrics:metricsR.data};
 state.draft=[...state.data.roster];
 present();
}
async function refresh(){if(state.session)await load();else present();}
async function init(){
 const {url,key}=window.FANTASY_CONFIG||{};
 if(!url||!key){state.session=null;renderAuth();return;}
 if(!window.supabase?.createClient){root.innerHTML='<div class="splash"><h2>Non se puido cargar a biblioteca de autenticación.</h2><p>Comproba a conexión a Internet e actualiza a páxina.</p></div>';return;}
 // Read a password-recovery marker before Supabase consumes the URL fragment.
 const hash=new URLSearchParams(location.hash.startsWith('#')?location.hash.slice(1):location.hash);
 if(hash.get('type')==='recovery'||new URLSearchParams(location.search).get('type')==='recovery'){
   state.recoveringPassword=true;state.page='security';
 }
 state.client=window.supabase.createClient(url,key,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});
 const {data,error}=await state.client.auth.getSession();
 if(error){state.session=null;renderAuth();toast('Non foi posible recuperar a sesión',true);return;}
 state.session=data.session;
 if(state.session){try{await load();}catch(e){missingDb(e);}}else renderAuth();
 state.client.auth.onAuthStateChange((event,session)=>{
   if(event==='PASSWORD_RECOVERY'){
     state.recoveringPassword=true;state.page='security';
     state.session=session;
     if(session)setTimeout(()=>load().catch(missingDb),0);
     return;
   }
   if(event==='SIGNED_IN'&&session?.user?.id!==state.session?.user?.id){
     state.session=session;
     setTimeout(()=>load().catch(missingDb),0);
   }
   if(event==='SIGNED_OUT'){
     state.session=null;state.data=null;state.page='home';
     state.recoveringPassword=false;state.authMode='password';renderAuth();
   }
 });
}
function showPlayer(id){
 const p=player(id);if(!p)return;
 const cost=prices()[id];
 const finished=new Set(state.data.fixtures.filter(f=>f.status==='finalized').map(f=>f.id));
 const pastScores=state.data.stats
  .filter(s=>s.player_id===id&&finished.has(s.fixture_id)&&s.played&&s.fantasy_points!==null)
  .map(s=>Number(s.fantasy_points));
 const estimate=brokerEstimate(cost,0,true,pastScores);
 const hist=state.data.history.filter(x=>x.player_id===id).slice(0,8);
 const el=document.createElement('div');el.className='modalcover';
 el.innerHTML='<div class="modal" role="dialog" aria-modal="true" aria-label="Perfil do xogador"><div class="row"><div class="person">'+playerAvatar(p,'profile-photo')+'<div><h2 style="margin:0">'+h(p.name)+'</h2><p class="mini">'+h(p.positions.join(' / '))+(p.category==='junior'?' · JÚNIOR':'')+'</p></div></div><button class="btn secondary" data-action="close-modal">Pechar</button></div><hr class="separator"><div class="grid three"><div><div class="kpi-label">Prezo actual</div><div class="kpi">'+euroShort(cost)+'</div></div><div><div class="kpi-label">Puntos para manter o prezo</div><div class="kpi">'+pts(estimate.expected)+'</div></div><div><div class="kpi-label">Máxima variación</div><div class="kpi">±15 %</div></div></div><div class="notice info" style="margin:15px 0">Bróker por media acumulada · '+pastScores.length+' partidos puntuados. Para subir ata +15 % precisa arredor de '+pts(estimate.thresholdPlus15)+' puntos Fantasy no próximo partido; para baixar ata −15 %, arredor de '+pts(estimate.thresholdMinus15)+'. Pode subir incluso cunha valoración negativa se a media acumulada segue sendo alta. Os límites e os arredondamentos poden modificar o resultado; sen xogar, o prezo non cambia.</div><h3>Historial de prezo</h3>'+(hist.length?hist.map(x=>'<div class="row" style="padding:8px 0;border-bottom:1px solid #e8eef3"><span>X'+x.round_number+'</span><b>'+euroShort(x.price_before)+' → '+euroShort(x.price_after)+(x.accumulated_average!==null&&x.accumulated_average!==undefined?' · Media '+pts(x.accumulated_average):'')+'</b></div>').join(''):'<p class="help">Aínda non hai variacións publicadas.</p>')+'</div>';
 document.body.append(el);state.modal=el;
}
async function interact(action,element){
 if(action==='mobile-more'){state.mobileMenuOpen=!state.mobileMenuOpen;present();if(state.mobileMenuOpen)root.querySelector('.menuclose')?.focus();else root.querySelector('[data-action="mobile-more"]')?.focus();return;}
 if(action==='close-more'){state.mobileMenuOpen=false;present();root.querySelector('[data-action="mobile-more"]')?.focus();return;}

 if(action==='password-page'){
   if(!state.session)return;
   state.page='security';present();return;
 }

 if(action==='logout'){await state.client?.auth.signOut();state.session=null;state.data=null;renderAuth();return;}
 if(action==='retry'){await refresh();return;}
 if(action==='set-alias'){
   const alias=prompt('Alias público (2-40 caracteres):',state.data?.alias||'');
   if(alias===null)return;
   if(alias.trim().length<2||alias.trim().length>40)throw Error('O alias debe ter entre 2 e 40 caracteres');
   await rpc('fantasy_set_alias',{p_alias:alias.trim()});
   toast('Alias gardado');await refresh();return;
 }
 if(action==='close-modal'){state.modal?.remove();state.modal=null;return;}
 if(action==='toggle'){
  const id=element.dataset.id;
  if(state.draft.includes(id))state.draft=state.draft.filter(x=>x!==id);
  else if(state.draft.length<5)state.draft.push(id);
  else return toast('O quinteto xa ten cinco xogadores: retira primeiro un.',true);
  present();return;
 }
 if(action==='save-lineup'){
  const d=state.data,check=validateLineup(state.draft,d.playerMap,d.prices),{open}=current();
  if(!check.valid||!open)throw Error('Quinteto incorrecto ou mercado pechado');
  if(d.team){
    const x=transferPlan(d.roster,state.draft,d.team.cash,d.prices);
    const n=d.transfers.filter(t=>t.round_number===current().pending?.round_number).length;
    if(x.cashAfter<0||x.changes+n>3)throw Error('Saldo insuficiente ou esgotaches os tres cambios');
    if(x.changes===0)return toast('Non hai fichaxes novos.');
    await rpc('fantasy_change_lineup',{p_team:d.team.id,p_player_ids:state.draft});
  }else{
    const name=document.getElementById('team-name')?.value?.trim();
    if(!name||name.length<2)throw Error('Indica un nome para o equipo');
    if(check.cost>6000000)throw Error('Superaches o orzamento de 6 millóns');
    await rpc('fantasy_create_team',{p_season:d.season.id,p_name:name,p_player_ids:state.draft});
  }
  toast('Quinteto gardado correctamente');state.page='team';await refresh();return;
 }
 if(action==='vote'){
  const fixture=element.dataset.fixture;
  const picks=[3,2,1].map(w=>document.getElementById('vote-'+w)?.value);
  if(picks.some(x=>!x)||new Set(picks).size!==3)throw Error('Escolle tres compañeiros diferentes');
  await rpc('fantasy_vote',{p_fixture:fixture,p_first:picks[0],p_second:picks[1],p_third:picks[2]});
  return toast('Voto rexistrado. Podes modificalo durante o prazo.');
 }
 if(['activate-season','update-kickoff','update-end','save-callups','save-stats','publish-round','add-junior','send-invite','upload-player-photo','remove-player-photo'].includes(action)){
  if(!admin())throw Error('Non tes permisos de administración');
  const changed=await adminAction(action);
  if(changed){toast('Operación realizada');await refresh();}
 }
}
root.addEventListener('click',async e=>{
 const authModeButton=e.target.closest('[data-auth-mode]');
 if(authModeButton){
   state.authMode=authModeButton.dataset.authMode;
   renderAuth();return;
 }
 const element=e.target.closest('[data-action],[data-page],[data-player]');
 if(!element)return;
 if(element.dataset.page){state.page=element.dataset.page;state.mobileMenuOpen=false;state.search='';state.filter='all';window.scrollTo({top:0,behavior:'instant'});present();root.querySelector('#main-content')?.focus({preventScroll:true});return;}
 if(element.dataset.player){showPlayer(element.dataset.player);return;}
 const action=element.dataset.action;if(!action)return;
 element.disabled=true;
 try{await interact(action,element);}catch(error){toast(error.message||String(error),true);}finally{if(element.isConnected)element.disabled=false;}
});
root.addEventListener('submit',async e=>{
 const form=e.target,formId=form.id;
 if(!['auth-password','auth-magic','auth-reset','auth-set-password'].includes(formId))return;
 e.preventDefault();
 const button=form.querySelector('button[type="submit"]');
 if(button)button.disabled=true;
 try{
   if(formId==='auth-set-password'){
     if(!state.session)throw Error('Precisas iniciar sesión antes de establecer a contrasinal');
     const password=form.elements.namedItem('password').value;
     const confirmPassword=form.elements.namedItem('confirm').value;
     if(password.length<10||password.length>128)throw Error('A contrasinal debe ter entre 10 e 128 caracteres');
     if(password!==confirmPassword)throw Error('As contrasinais non coinciden');
     const {error}=await state.client.auth.updateUser({password});
     if(error)throw error;
     form.reset();
     state.recoveringPassword=false;
     state.page='home';
     toast('Contrasinal gardada. Xa podes entrar co teu correo e contrasinal.');
     await refresh();
     return;
   }
   const email=form.elements.namedItem('email').value.trim().toLowerCase();
   if(formId==='auth-password'){
     const password=form.elements.namedItem('password').value;
     const {data,error}=await state.client.auth.signInWithPassword({email,password});
     if(error||!data.session)throw Error('Correo ou contrasinal incorrectos. Se aínda non configuraches unha contrasinal, utiliza «Primeiro acceso».');
     state.session=data.session;
     state.page='home';state.recoveringPassword=false;
     await load();
   }else if(formId==='auth-magic'){
     const {error}=await state.client.auth.signInWithOtp({
       email,options:{shouldCreateUser:false,emailRedirectTo:location.origin}
     });
     if(error)throw Error('Non foi posible enviar a ligazón de acceso. Téntao máis tarde.');
     toast('Se a túa conta xa está invitada, recibirás unha ligazón de acceso.');
     form.reset();
   }else if(formId==='auth-reset'){
     const {error}=await state.client.auth.resetPasswordForEmail(email,{redirectTo:location.origin});
     if(error)throw Error('Non foi posible solicitar a recuperación. Téntao máis tarde.');
     toast('Se a conta existe, recibirás un correo para restablecer a contrasinal.');
     state.authMode='password';
     renderAuth();
   }
 }catch(error){
   toast(error.message||'Produciuse un erro. Reinténtao.',true);
 }finally{if(button?.isConnected)button.disabled=false;}
});
root.addEventListener('input',e=>{
 if(e.target.id==='search'){state.search=e.target.value;const box=document.getElementById('market-table');if(box)box.innerHTML=marketTable();}
});
root.addEventListener('change',async e=>{
 if(e.target.id==='pos-filter'){state.filter=e.target.value;const box=document.getElementById('market-table');if(box)box.innerHTML=marketTable();}
 if(e.target.id==='admin-photo-player'){state.adminPlayer=e.target.value;present();}
 if(e.target.id==='admin-photo-file'){
   const file=e.target.files?.[0];
   const holder=document.getElementById('admin-photo-preview');
   if(holder&&file&&['image/jpeg','image/png','image/webp'].includes(file.type)){
     const previous=holder.dataset.objectUrl;
     if(previous)URL.revokeObjectURL(previous);
     const next=URL.createObjectURL(file);
     holder.dataset.objectUrl=next;
     holder.innerHTML='<img class="admin-photo-avatar" alt="Vista previa da fotografía" src="'+next+'"><p>Vista previa · '+h(file.name)+'</p>';
   }
 }
 if(e.target.id==='admin-fixture'){state.adminFixture=e.target.value;state.importRows=null;state.rawPdf='';present();}
 if(e.target.id==='stats-file'){
  try{const msg=await handleStatsFile(e.target.files[0]);toast(msg);present();}catch(error){toast(error.message||String(error),true);}
 }
});
document.addEventListener('click',e=>{if(state.modal&&(e.target===state.modal||e.target.closest('[data-action="close-modal"]'))){state.modal.remove();state.modal=null;}});
window.addEventListener('keydown',e=>{
 if(e.key==='Tab'&&state.mobileMenuOpen){
   const sheet=root.querySelector('.mobile-more-sheet');
   const focusable=[...(sheet?.querySelectorAll('button:not(:disabled),a[href]')||[])].filter(el=>el.getClientRects().length);
   if(focusable.length){
     const first=focusable[0],last=focusable[focusable.length-1],active=document.activeElement;
     if(e.shiftKey&&(active===first||!sheet.contains(active))){e.preventDefault();last.focus();}
     else if(!e.shiftKey&&(active===last||!sheet.contains(active))){e.preventDefault();first.focus();}
   }
 }
 if(e.key!=='Escape')return;
 if(state.modal){state.modal.remove();state.modal=null;}
 else if(state.mobileMenuOpen){state.mobileMenuOpen=false;present();root.querySelector('[data-action="mobile-more"]')?.focus();}
});
init().catch(err=>missingDb(err));
