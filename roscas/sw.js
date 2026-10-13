// Rosca Fácil by DayIA · guarda as telas para abrir mais rápido (a medição sempre usa a internet)
var CACHE = "rosca-facil-v32";
var ARQ = ["./", "index.html", "tabelas.js?v=32", "config.js?v=32", "medir.js?v=32", "local.js?v=32", "dayia-simbolo.png", "dayia-logo.png", "exemplo.jpg", "manifest.webmanifest", "icon-192.png", "icon-512.png"];
self.addEventListener("install", function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ARQ); })); self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }));
  self.clients.claim();
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(function (r) { var c = r.clone(); caches.open(CACHE).then(function (k) { k.put(e.request, c); }); return r; })
    .catch(function () { return caches.match(e.request); }));
});
