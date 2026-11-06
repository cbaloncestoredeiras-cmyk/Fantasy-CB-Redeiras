// Offline access is intentionally limited to the public interface shell.
// Never cache Supabase API responses, account state, auth tokens, or private photos.
const CACHE='redeiras-public-shell-v1.4';
const BOOT=['/offline.html','/assets/marine-waves.svg','/assets/marine-net.svg','/assets/marine-fish.svg','/assets/fantasy-192.png','/assets/fantasy-512.png'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(c=>c.addAll(BOOT)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('redeiras-public-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const u=new URL(req.url);
 if(u.origin!==self.location.origin)return;
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).catch(()=>caches.match('/offline.html')));
  return;
 }
 if(!/\.(?:css|js|svg|png|webp)$/.test(u.pathname)||u.pathname==='/config.js')return;
 event.respondWith(fetch(req).then(response=>{
  if(response.ok&&response.type==='basic'){
   const copy=response.clone();
   event.waitUntil(caches.open(CACHE).then(c=>c.put(req,copy)));
  }
  return response;
 }).catch(()=>caches.match(req)));
});
// Web Push messages carry only a round number, never private user data.
self.addEventListener('push',event=>{
 let message={};
 try{message=event.data?.json()||{};}catch{message={};}
 if(message.kind!=='market-reminder')return;
 const round=Number(message.round);
 if(!Number.isInteger(round)||round<1||round>500)return;
 event.waitUntil(self.registration.showNotification('Fantasy CB Redeiras · mercado',{
  body:'O mercado da xornada X'+round+' pecha en menos dunha hora.',
  icon:'/assets/fantasy-192.png',badge:'/assets/fantasy-192.png',
  tag:'redeiras-remote-X'+round,renotify:false,data:{url:'/'}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{
  if(clients.length)return clients[0].focus();
  return self.clients.openWindow('/');
 }));
});
