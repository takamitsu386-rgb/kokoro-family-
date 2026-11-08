// Keep this app's offline cache isolated from other apps on the same origin.
const CACHE_NAME="kokoro-family-v176";
const CACHE_PREFIX="kokoro-family-";
const APP_SHELL=["./","./index.html","./manifest.webmanifest","./icon.svg"];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key))
    )).then(()=>self.clients.claim())
  );
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET"||new URL(event.request.url).origin!==self.location.origin)return;
  const isAppNavigation=event.request.mode==="navigate"||new URL(event.request.url).pathname.endsWith("/index.html");
  if(isAppNavigation){
    event.respondWith(
      fetch(event.request).then(response=>{
        if(response.ok){
          const copy=response.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy)).catch(()=>{});
        }
        return response;
      }).catch(()=>caches.open(CACHE_NAME).then(cache=>
        cache.match(event.request).then(cached=>cached||cache.match("./index.html"))
      ).then(fallback=>fallback||Response.error()))
    );
    return;
  }
  event.respondWith(
    caches.open(CACHE_NAME).then(cache=>cache.match(event.request)).then(cached=>
      cached||fetch(event.request).then(response=>{
        if(response.ok){
          const copy=response.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy)).catch(()=>{});
        }
        return response;
      }).catch(()=>Response.error())
    )
  );
});
