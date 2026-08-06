var C="wb-v3",A=["/manifest.json","/icon-192.png","/icon-512.png"];
self.addEventListener("install",function(e){e.waitUntil(caches.open(C).then(function(c){return c.addAll(A)}));self.skipWaiting()});
self.addEventListener("activate",function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.map(function(x){return caches.delete(x)}))}));self.clients.claim()});
self.addEventListener("fetch",function(e){if(e.request.url.match(/\.(html|json|js)$/)||e.request.mode==="navigate"){e.respondWith(fetch(e.request))}else{e.respondWith(caches.match(e.request).then(function(ca){return ca||fetch(e.request).then(function(r){if(r.ok){var cl=r.clone();caches.open(C).then(function(c){return c.put(e.request,cl)});}return r})}))}});
