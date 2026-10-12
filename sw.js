/* SoccerSpot v2 : shell disponible après installation, données en ligne non mises en cache. */
const CACHE_NAME='soccerspot-cloud-v4';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./config.js','./cloud.js','./cloud.css'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL)));
 self.skipWaiting();
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('soccerspot-')&&k!==CACHE_NAME).map(k=>caches.delete(k)))));
 self.clients.claim();
});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin)return;
 event.respondWith(fetch(req).then(response=>{
  if(response.ok)event.waitUntil(caches.open(CACHE_NAME).then(c=>c.put(req,response.clone())));
  return response;
 }).catch(async()=>{
  const cached=await caches.match(req,{ignoreSearch:true});
  if(cached)return cached;
  if(req.mode==='navigate')return (await caches.match('./index.html'))||Response.error();
  return Response.error();
 }));
});
