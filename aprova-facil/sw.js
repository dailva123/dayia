const CACHE="aprovafacil-v10";
const ARQ=["./","index.html","estilo.css","app.js","extras.js","questoes.js","manifest.webmanifest","logo-simbolo.png","logo-by.png","icon-192.png","icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ARQ)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
// Busca sempre a versão nova; sem internet, usa a guardada
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  e.respondWith(fetch(e.request).then(r=>{if(r&&r.ok&&new URL(e.request.url).origin===location.origin){const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c))}return r}).catch(()=>caches.match(e.request).then(g=>g||caches.match("index.html"))));
});
