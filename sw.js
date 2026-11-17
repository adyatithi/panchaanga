// Offline support. The shell is cached on install; data files are cached as they are read.
// Everything is served stale-while-revalidate, so a visit online refreshes what a later visit offline will see.
const CACHE = 'adyatithi-v4';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/util.js', 'js/data.js', 'js/parts.js',
  'js/view-dina.js', 'js/view-vistara.js', 'js/view-kala.js', 'js/view-masa.js', 'js/view-parva.js', 'js/view-misc.js', 'js/view-pathana.js', 'js/share.js', 'js/view-saptaha.js',
  'manifest.webmanifest', 'icons/adyatithi.png', 'data/index.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(e.request);
    const fresh = fetch(e.request).then((res) => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    }).catch(() => hit);
    return hit || fresh;
  }));
});
