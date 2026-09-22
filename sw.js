const CACHE="chord-ear-trainer-v21";
const SHELL=[
  "/music/",
  "/music/index.html",
  "/music/styles.css",
  "/music/app.js",
  "/music/db.js",
  "/music/manifest.json",
  "/music/icons/icon-192.png",
  "/music/icons/icon-512.png"
];

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE).then(cache=>cache.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>
      Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;

  if(event.request.mode==="navigate"){
    event.respondWith(
      fetch(event.request).catch(()=>caches.match("/music/index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached=>
      cached||fetch(event.request).then(response=>{
        if(response&&response.ok&&new URL(event.request.url).origin===self.location.origin){
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,copy));
        }
        return response;
      })
    )
  );
});
