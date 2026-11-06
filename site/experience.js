// Lightweight, privacy-preserving onboarding and in-app market reminders.
// This version does not provide remote push when the browser/app is closed.
import {escapeHtml as h,pickUpcoming} from './logic.js';
import {publicPushKey,remotePushSupported,remotePushEnabled} from './push.js';
const STEPS=[
 {title:'Crea o teu quinteto',symbol:'01',description:'Escolle cinco xogadores. Debes incluír un base (BA) e outro xogador interior (AP ou P). Non poden ser a mesma persoa.',target:'market',action:'Ir ao mercado'},
 {title:'Xestiona o orzamento',symbol:'02',description:'Comezas con 6 millóns virtuais. Antes de confirmar podes comparar xogadores, simular saídas e entradas e revisar o efectivo restante.',target:'market',action:'Probar o simulador'},
 {title:'Segue a xornada',symbol:'03',description:'O mercado pecha cando comeza o partido. A puntuación e os prezos do bróker actualízanse cando se publican as estatísticas oficiais da xornada.',target:'calendar',action:'Ver o calendario'},
 {title:'Compite e participa',symbol:'04',description:'Consulta a clasificación xeral e por xornada. Os xogadores convocados tamén poden votar 3, 2 e 1 punto no prazo establecido.',target:'ranking',action:'Ver a clasificación'}
];
const ALERT_PREF='redeiras:device-alerts:v1';
const alertKey=id=>'redeiras:one-hour:'+id;
const safeStorage=()=>{
 try{return typeof localStorage==='undefined'?null:localStorage;}catch{return null;}
};
export function deadline(state,now=Date.now()){
 const d=state?.data,season=d?.season;
 if(!d||!season?.active)return {status:'inactive',ms:null,pending:null};
 const upcoming=pickUpcoming(d.fixtures,season).pending;
 if(!upcoming?.starts_at||upcoming.status!=='scheduled')return {status:'unavailable',ms:null,pending:upcoming||null};
 const ms=new Date(upcoming.starts_at).getTime()-now;
 return {status:ms>0?'open':'closed',ms,pending:upcoming};
}
export function countdown(ms){
 if(ms===null||!Number.isFinite(ms))return 'Horario pendente';
 if(ms<=0)return 'Mercado pechado';
 const minutes=Math.ceil(ms/60000),days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),mins=minutes%60;
 if(days)return 'Pecha en '+days+' d '+hours+' h';
 if(hours)return 'Pecha en '+hours+' h '+mins+' min';
 return 'Pecha en '+minutes+' min';
}
function installed(){
 return typeof window!=='undefined'&&(window.matchMedia?.('(display-mode: standalone)').matches||window.navigator?.standalone===true);
}
export function homeExperience(state){
 const info=deadline(state);
 const c=info.status==='open'?countdown(info.ms):info.status==='inactive'?'Tempada aínda sen activar':'Consulta o calendario para o seguinte partido';
 return '<section class="sea-home-strip" aria-label="Guía e recordatorios"><div class="sea-home-message"><span class="sea-salt">MAR · REDE · BALONCESTO</span><h2>O Fantasy tamén é Redeiras.</h2>'+
  '<p>Descubre as regras, instala a app e prepara cada xornada desde o móbil.</p><div class="actions"><button type="button" class="btn primary" data-page="guide">Como se xoga</button><button type="button" class="btn sea-light" data-action="install-app">Instalar app</button></div></div>'+
  '<div class="sea-home-alert"><span class="sea-eyebrow">PRÓXIMO PECHAMENTO</span><strong class="sea-live-countdown">'+h(c)+'</strong>'+
  '<small>Os cambios só se poden confirmar co mercado aberto.</small><button type="button" data-page="calendar" class="sea-text-link">Consultar calendario</button></div></section>';
}
export function guidePage(state){
 const n=Math.max(0,Math.min(STEPS.length-1,Number(state.guideStep)||0)),step=STEPS[n];
 const unsupported=typeof Notification==='undefined'||typeof navigator==='undefined'||!('serviceWorker' in navigator);
 const perm=unsupported?'unsupported':Notification.permission;
 const optIn=safeStorage()?.getItem(ALERT_PREF)==='on';
 const remoteSupported=remotePushSupported();
 const remoteReady=!!publicPushKey();
 const remoteOn=remotePushEnabled(state);
 const button=perm==='denied'
  ?'<p class="mini muted">Bloqueaches as notificacións no navegador. Podes cambialo na configuración do dispositivo.</p>'
  :unsupported?'<p class="mini muted">O teu navegador non admite este tipo de aviso.</p>'
  :'<button type="button" class="btn '+(optIn?'secondary':'primary')+'" data-action="toggle-device-alerts">'+(optIn?'Desactivar avisos':'Activar avisos neste dispositivo')+'</button>';
 return '<div class="heading"><div><span class="eyebrow">FANTASY REDEIRAS / GUÍA</span><h1>O xogo, paso a paso.</h1>'+
  '<p>Catro ideas para comezar a competir. Sempre podes volver aquí.</p></div></div>'+
  '<section class="panel sea-guide" aria-label="Tutorial de Fantasy"><div class="sea-guide-head"><span class="sea-step-number">PASO '+step.symbol+' / 04</span><div class="sea-guide-progress" aria-label="Seleccionar paso">'+
  STEPS.map((s,i)=>'<button type="button" data-action="guide-step" data-step="'+i+'" aria-label="Paso '+(i+1)+': '+h(s.title)+'" aria-current="'+(i===n?'step':'false')+'" class="'+(i===n?'selected':'')+'">'+(i+1)+'</button>').join('')+
  '</div></div><div class="sea-guide-body"><div><span class="sea-guide-giant">'+step.symbol+'</span><h2>'+h(step.title)+'</h2><p>'+h(step.description)+'</p>'+
  '<div class="actions"><button type="button" class="btn secondary" data-action="guide-prev" '+(n===0?'disabled':'')+'>Anterior</button>'+
  '<button type="button" class="btn primary" data-action="guide-next" '+(n===STEPS.length-1?'disabled':'')+'>Seguinte</button>'+
  '<button type="button" class="btn outline" data-page="'+h(step.target)+'">'+h(step.action)+'</button></div></div><div class="sea-guide-art" aria-hidden="true"></div></div></section>'+
  '<div class="grid two sea-tools"><section class="panel"><span class="sea-tool-icon" aria-hidden="true">⌂</span><h2>Leva o Fantasy no peto</h2>'+
  '<p>Instala a web como aplicación no móbil ou no ordenador, sen descargar nada dunha tenda.</p>'+
  (installed()?'<p class="tag good">Estás usando a versión instalada</p>':'<button type="button" class="btn primary" data-action="install-app">Instalar Fantasy</button>')+
  (state.installHelp?'<div class="sea-install-help" role="status"><strong>Como instalala</strong><p><b>iPhone / iPad:</b> abre a web en Safari → Compartir → Engadir á pantalla de inicio.</p><p><b>Android:</b> no menú do navegador, «Instalar app» ou «Engadir á pantalla de inicio».</p><p><b>Ordenador:</b> usa a opción «Instalar aplicación» do navegador compatible.</p></div>':'')+
  '</section><section class="panel"><span class="sea-tool-icon" aria-hidden="true">◷</span><h2>Avisos do mercado</h2>'+
  '<p>Avisa cando quede menos dunha hora para o peche, só <b>mentres a app está aberta</b>. Tamén podes activar as notificacións remotas unha vez configuradas.</p>'+
  button+'<p class="mini muted">Activación voluntaria e reversible neste dispositivo. Sen datos persoais nas notificacións.</p>'+
  '<div class="push-settings"><h3>Avisos coa app pechada</h3><p class="mini">Notificacións Web Push voluntarias, cun aviso de peche do mercado aínda que non teñas a app aberta. En iPhone necesitas a app instalada desde Safari.</p>'+
  (!remoteSupported?'<p class="mini muted">Este dispositivo non admite Web Push (ou a web non está instalada).</p>':
   !remoteReady?'<p class="mini muted">Funcionalidade preparada. Falta configurar o envío seguro no servidor.</p>':
   '<button type="button" class="btn '+(remoteOn?'secondary':'primary')+'" data-action="'+(remoteOn?'remote-push-disable':'remote-push-enable')+'">'+(remoteOn?'Desactivar no dispositivo':'Activar coa app pechada')+'</button>')+
  '<p class="mini muted">Nunca se solicita permiso sen premer o botón. Revogable en calquera momento.</p></div></section></div>';
}
let deferredInstall=null,initialized=false;
export function installAppPrompt(){
 if(installed())return Promise.resolve({status:'installed'});
 if(!deferredInstall)return Promise.resolve({status:'manual'});
 const e=deferredInstall;deferredInstall=null;
 // prompt() must be invoked directly from the user's click handler.
 e.prompt();
 return e.userChoice.then(choice=>({status:choice.outcome})).catch(()=>({status:'manual'}));
}
export async function toggleDeviceAlerts(){
 const store=safeStorage();
 if(!store||typeof Notification==='undefined'||!('serviceWorker' in navigator))return 'Este navegador non admite avisos locais.';
 if(store.getItem(ALERT_PREF)==='on'){
   store.removeItem(ALERT_PREF);return 'Avisos desactivados neste dispositivo.';
 }
 // Call from an actual user interaction; never request automatically at login.
 const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
 if(permission!=='granted')return 'Non se concedeu permiso para os avisos.';
 store.setItem(ALERT_PREF,'on');
 return 'Avisos activados mentres teñas aberta a aplicación.';
}
export function refreshClock(state){
 const info=deadline(state);
 for(const node of document.querySelectorAll('.sea-live-countdown')){
  node.textContent=info.status==='open'?countdown(info.ms):info.status==='inactive'?'Tempada aínda sen activar':'Mercado pechado';
 }
 if(info.status==='closed'){
  const save=document.querySelector('[data-action="save-lineup"]');if(save)save.disabled=true;
  const pill=document.querySelector('.topbar .pill');
  if(pill){pill.textContent='Mercado pechado';pill.classList.add('negative');}
 }
}
async function checkOneHour(state){
 const info=deadline(state);
 if(info.status!=='open'||info.ms>3600000||!info.pending)return;
 const store=safeStorage();if(!store||store.getItem(ALERT_PREF)!=='on')return;
 if(typeof Notification==='undefined'||Notification.permission!=='granted')return;
 if(remotePushEnabled(state))return; // Avoid double alerts if the remote subscription is active.
 const key=alertKey(info.pending.id);
 if(store.getItem(key)==='sent')return;
 if(typeof navigator==='undefined'||!('serviceWorker' in navigator))return;
 try{
  const registration=await navigator.serviceWorker.ready;
  await registration.showNotification('Fantasy CB Redeiras · mercado', {
    body:'O mercado da xornada X'+info.pending.round_number+' pecha en menos dunha hora.',
    icon:'/assets/fantasy-192.png',tag:'redeiras-market-'+info.pending.id,renotify:false
  });
  store.setItem(key,'sent');
 }catch(e){console.warn('Non se puido amosar o aviso do mercado',e);}
}
export function initExperience(state){
 if(initialized)return;initialized=true;
 if(typeof window==='undefined'||typeof navigator==='undefined')return;
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;});
 window.addEventListener('appinstalled',()=>{deferredInstall=null;});
 if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(e=>console.warn('PWA non dispoñible',e));
 }
 const tick=()=>{if(!state.session||!state.data)return;refreshClock(state);void checkOneHour(state);};
 setInterval(tick,30000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});
}
