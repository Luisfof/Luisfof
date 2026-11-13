/* Service worker do MORAA GO.
   - Navegação: rede primeiro; sem rede, usa o shell em cache ou a página offline.
   - Estáticos com hash, imagens e fontes: cache primeiro (stale-while-revalidate).
   - /api e /uploads privados nunca são armazenados (dados sempre atuais, sem vazar sessão). */
const V = 'moraa-v1';
const SHELL = ['/', '/offline.html', '/favicon.svg', '/icons/icon-192.png', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok && url.pathname === '/') { const copy = res.clone(); caches.open(V).then((c) => c.put('/', copy)); }
        return res;
      }).catch(async () => (await caches.match('/')) || (await caches.match('/offline.html'))),
    );
    return;
  }
  if (/^\/(assets|img|icons|uploads)\//.test(url.pathname) || /\.(woff2|svg|png|webp|jpg)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req).then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(V).then((c) => c.put(req, copy)); }
          return res;
        }).catch(() => hit);
        return hit || net;
      }),
    );
  }
});
