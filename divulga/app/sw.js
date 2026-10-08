/* Divulga Fácil by DayIA — service worker (instalar no celular) */
self.addEventListener("install",function(){self.skipWaiting()});
self.addEventListener("activate",function(e){e.waitUntil(self.clients.claim())});
self.addEventListener("fetch",function(e){
  if(e.request.mode!=="navigate")return;
  e.respondWith(fetch(e.request).catch(function(){
    return new Response('<meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="font-family:sans-serif;background:#0E2238;color:#fff;display:grid;place-items:center;height:100vh;margin:0;text-align:center"><div><h2>Sem internet</h2><p>Conecte-se e abra de novo.</p></div>',{headers:{"Content-Type":"text/html; charset=utf-8"}});
  }));
});
self.addEventListener("notificationclick",function(e){
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(function(l){
    for(var i=0;i<l.length;i++){if("focus" in l[i])return l[i].focus()}
    return self.clients.openWindow(self.registration.scope);
  }));
});
