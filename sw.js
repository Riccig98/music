const CACHE="chordlab-v25";
const SCOPE_PATH="/music/";

self.addEventListener("install",event=>{
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache=>cache.addAll([
      "/music/index.html",
      "/music/styles.css?v=25",
      "/music/app.js?v=25",
      "/music/db.js",
      "/music/manifest.webmanifest",
      "/music/icons/icon-192.png",
      "/music/icons/icon-512.png"
    ]))
  );
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys
      .filter(key=>key!==CACHE)
      .map(key=>caches.delete(key))
    );

    await self.clients.claim();

    const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    for(const client of windows){
      try{
        const url=new URL(client.url);
        if(url.origin===self.location.origin&&url.pathname.startsWith(SCOPE_PATH)){
          if(!url.searchParams.has("fresh")){
            url.searchParams.set("fresh","25");
            await client.navigate(url.href);
          }
        }
      }catch(_){}
    }
  })());
});

self.addEventListener("message",event=>{
  if(event.data&&event.data.type==="SKIP_WAITING"){
    self.skipWaiting();
  }
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;

  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;

  if(event.request.mode==="navigate"){
    event.respondWith(
      fetch(event.request,{cache:"no-store"})
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put("/music/index.html",copy));
          return response;
        })
        .catch(()=>caches.match("/music/index.html"))
    );
    return;
  }

  if(url.pathname.endsWith("/manifest.webmanifest")){
    event.respondWith(fetch(event.request,{cache:"no-store"}));
    return;
  }

  event.respondWith(
    fetch(event.request,{cache:"no-store"})
      .then(response=>{
        if(response&&response.ok){
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,copy));
        }
        return response;
      })
      .catch(()=>caches.match(event.request))
  );
});
