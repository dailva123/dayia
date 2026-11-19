/* Registro Fácil by DayIA — deixa o app abrir rápido e instalar no celular.
   Os envios para o Google NUNCA passam pelo cache. */
const CACHE = "registrofacil-v5";
const ARQUIVOS = ["./", "./index.html", "./manifest.json", "./logo.png", "./logo-simbolo.png", "./logo-by.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;                                   // envios: direto para a internet
  if (new URL(req.url).origin !== self.location.origin) return;        // Google, Drive etc.: direto
  // primeiro tenta a internet (pega a versão mais nova); sem internet, usa a cópia guardada
  e.respondWith(
    fetch(req).then(r => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
      return r;
    }).catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
  );
});
