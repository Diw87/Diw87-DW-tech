'use strict';
const PREFIX='dwtech-autoescola-';
const CACHE=PREFIX+'20261021-v1';
const BASE=self.registration.scope;
const FILES=['./','./index.html','./pwa.js','./application.js','./manifest.webmanifest','./assets/icon-192.png','./assets/icon-512.png','./assets/icon-maskable-512.png','./assets/apple-touch-icon.png','./assets/dw-tech.png','./assets/autoescola-logo.png'];
const STATIC=new Set(FILES.map(file=>new URL(file,BASE).href));
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(BASE))return;
  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      try{
        const response=await fetch(request,{cache:'no-store'});
        if(response.ok){await cache.put(new URL('./index.html',BASE).href,response.clone());return response;}
        return await cache.match(new URL('./index.html',BASE).href)||response;
      }catch{
        return await cache.match(new URL('./index.html',BASE).href)||Response.error();
      }
    })());return;
  }
  if(!STATIC.has(url.href))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{
      const response=await fetch(request);
      if(response.ok)await cache.put(request,response.clone());
      return response;
    }catch{return await cache.match(request)||Response.error();}
  })());
});
