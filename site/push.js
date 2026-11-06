// Opt-in browser Web Push for a single signed-in Fantasy account.
// Never store VAPID private keys, subscription secrets or user emails in the site.
const storage=()=>{try{return typeof localStorage==='undefined'?null:localStorage;}catch{return null;}};
const pref=id=>'redeiras:remote-push:'+id;
export function publicPushKey(){
 return typeof window==='undefined'?'':String(window.FANTASY_CONFIG?.pushPublicKey||'').trim();
}
export function remotePushSupported(){
 return typeof navigator!=='undefined'&&'serviceWorker' in navigator&&
 typeof window!=='undefined'&&'PushManager' in window&&typeof Notification!=='undefined';
}
export function remotePushEnabled(state){
 return !!(state?.session?.user?.id&&storage()?.getItem(pref(state.session.user.id))==='on');
}
export function decodeVapidKey(encoded){
 if(!/^[A-Za-z0-9_-]{80,120}$/.test(encoded))throw new Error('A chave pública push é incorrecta');
 const pad='='.repeat((4-encoded.length%4)%4);
 const raw=atob((encoded+pad).replace(/-/g,'+').replace(/_/g,'/'));
 return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
export async function enableRemotePush(state){
 if(!state?.session?.user?.id||!state?.client)throw new Error('Inicia sesión para activar os avisos');
 if(!remotePushSupported())throw new Error('Este navegador non admite notificacións Web Push. En iPhone, instala primeiro a web desde Safari.');
 const vapid=publicPushKey();
 if(!vapid)throw new Error('O envío coa app pechada aínda non está configurado no servidor');
 const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
 if(permission!=='granted')throw new Error('É necesario aceptar os avisos do dispositivo');
 const reg=await navigator.serviceWorker.ready;
 let sub=await reg.pushManager.getSubscription(),newSub=false;
 if(!sub){sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeVapidKey(vapid)});newSub=true;}
 const json=sub.toJSON(),keys=json.keys||{};
 if(!sub.endpoint||!keys.p256dh||!keys.auth){if(newSub)await sub.unsubscribe();throw new Error('A subscrición push está incompleta');}
 const {error}=await state.client.rpc('fantasy_push_register',{p_endpoint:sub.endpoint,p_p256dh:keys.p256dh,p_auth:keys.auth});
 if(error){
  if(newSub)await sub.unsubscribe().catch(()=>{});
  throw new Error('Non se puido vincular este dispositivo: '+error.message);
 }
 storage()?.setItem(pref(state.session.user.id),'on');
 return 'Avisos coa app pechada activados neste dispositivo.';
}
export async function disableRemotePush(state){
 if(!state?.session?.user?.id||!state?.client)return 'Non hai unha sesión activa';
 if(!remotePushSupported()){storage()?.removeItem(pref(state.session.user.id));return 'Preferencia de avisos desactivada';}
 const reg=await navigator.serviceWorker.ready;
 const sub=await reg.pushManager.getSubscription();
 if(sub?.endpoint){
  const {error}=await state.client.rpc('fantasy_push_unsubscribe',{p_endpoint:sub.endpoint});
  if(error)throw new Error('Non se puido revogar a subscrición: '+error.message);
  await sub.unsubscribe();
 }
 storage()?.removeItem(pref(state.session.user.id));
 return 'Avisos remotos desactivados neste dispositivo.';
}
