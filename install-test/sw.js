var GHPATH = "/music/install-test";
var APP_PREFIX = "chordtest_";
var VERSION = "version_002";
var URLS = [
  GHPATH + "/",
  GHPATH + "/index.html",
  "/music/icons/icon-700.png"
];

var CACHE_NAME = APP_PREFIX + VERSION;

self.addEventListener("fetch",function(event){
  event.respondWith(
    caches.match(event.request).then(function(request){
      return request || fetch(event.request);
    })
  );
});

self.addEventListener("install",function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(URLS);
    })
  );
});

self.addEventListener("activate",function(event){
  event.waitUntil(
    caches.keys().then(function(keyList){
      var cacheWhitelist=keyList.filter(function(key){
        return key.indexOf(APP_PREFIX)===0;
      });
      cacheWhitelist.push(CACHE_NAME);
      return Promise.all(keyList.map(function(key){
        if(cacheWhitelist.indexOf(key)===-1){
          return caches.delete(key);
        }
      }));
    })
  );
});
