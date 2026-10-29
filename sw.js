const CACHE='silent-warrior-v4';
const ASSETS=['./','index.html','style.css','app.js','account-ui.js','social-login.js','account-data.js','model.js','habit-catalog.js','analytics.js','weight.js','push-ui.js','reorder.js','manifest.webmanifest','icon-v3.svg','icon-192-v3.png','icon-512-v3.png','apple-touch-icon-v3.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('silent-warrior-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(url.search||event.request.method!=='GET'||url.origin!==self.location.origin||!ASSETS.some(path=>new URL(path,self.registration.scope).pathname===url.pathname))return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}return response;}).catch(async()=>{const cached=await caches.match(event.request);if(cached)return cached;if(event.request.mode==='navigate')return caches.match(new URL('index.html',self.registration.scope));throw new Error('Offline asset unavailable');}));
});
// Background reminders need a deployed push sender and an explicit subscription.
// This receiver alone does not schedule or send notifications.
self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{};}catch{}
 event.waitUntil(self.registration.showNotification(typeof data.title==='string'?data.title:'הלוחם השקט',{
  body:typeof data.body==='string'?data.body:'רגע קטן לשגרה שלך. אפשר לפתוח ולסמן.',
  icon:new URL('icon-192-v3.png',self.registration.scope).href,
  badge:new URL('icon-192-v3.png',self.registration.scope).href,
  tag:'silent-warrior-reminder',data:{url:self.registration.scope}
 }));
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{const existing=clients.find(c=>c.url.startsWith(self.registration.scope));if(existing){await existing.focus();return;}return self.clients.openWindow(self.registration.scope);}));});
