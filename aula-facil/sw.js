const CACHE="aulafacil-v50";
const ARQ=["./","index.html","manifest.webmanifest","icon-192.png","icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ARQ)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  const pagina=e.request.mode==="navigate"||/\/(index\.html)?$/.test(new URL(e.request.url).pathname);
  if(pagina){
    // Página do app: busca sempre a versão nova; sem internet, abre a guardada
    e.respondWith(fetch(e.request).then(r=>{if(r&&r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put("index.html",c))}return r}).catch(()=>caches.match("index.html").then(g=>g||caches.match("./"))));
    return;
  }
  e.respondWith(caches.match(e.request).then(guardado=>{
    const rede=fetch(e.request).then(r=>{if(r&&r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c))}return r}).catch(()=>guardado);
    return guardado||rede;
  }));
});
