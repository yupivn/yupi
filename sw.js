// Vỏ app Yupi: luôn lấy trang mới khi có mạng, mất mạng thì mở bản đã lưu.
const C = 'yupi-v11';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(['./', 'index.html', 'shim.js', 'manifest.json', 'icon-192.png'])));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(C).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request)));
});
