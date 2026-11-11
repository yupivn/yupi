// Vỏ app Yupi: luôn lấy trang mới khi có mạng, mất mạng thì mở bản đã lưu.
// 12/11/2026: + THÔNG BÁO ĐẨY (tin khách / đề xuất cần duyệt) – bấm thông báo mở kênh Duyệt tin khách đúng tin đó
const C = 'yupi-v15';
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
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { t: 'Yupi', b: e.data ? e.data.text() : '' }; }
  const o = { body: d.b || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || 'yupi', renotify: true, data: { url: d.u || 'kenh.html' } };
  e.waitUntil(self.registration.showNotification(d.t || 'Yupi', o).then(() => {
    // báo các trang đang mở: có tin mới -> tải ngay
    return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => cs.forEach(c => { try { c.postMessage({ yupiPush: 1, tag: d.tag }); } catch (x) {} }));
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || 'kenh.html', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) {
      if (c.url.indexOf(self.registration.scope) === 0 && 'focus' in c) {
        return c.focus().then(w => { try { return (w || c).navigate(url); } catch (x) { return w; } }).catch(() => self.clients.openWindow(url));
      }
    }
    return self.clients.openWindow(url);
  }));
});
