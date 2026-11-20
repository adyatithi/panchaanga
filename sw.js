// Offline support. The shell is cached on install; data files are cached as they are read.
// Everything is served stale-while-revalidate, so a visit online refreshes what a later visit offline will see.
// The stable site and the nightly one (under nightly/) share an origin, so each keeps to its own
// caches, and the stable worker leaves the nightly pages, which have their own worker, alone.
const VERSION = 'v30';
const NIGHTLY = /\/nightly\/$/.test(new URL(self.registration.scope).pathname);
const FAMILY = NIGHTLY ? 'adyatithi-nightly-' : 'adyatithi-';
const CACHE = FAMILY + VERSION;
const NIGHTLY_PATH = new URL('nightly/', self.registration.scope).pathname;
const SHELL = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/util.js', 'js/data.js', 'js/parts.js',
  'js/view-dina.js', 'js/view-vistara.js', 'js/view-kala.js', 'js/view-masa.js', 'js/view-parva.js', 'js/view-misc.js', 'js/view-pathana.js', 'js/share.js', 'js/view-saptaha.js', 'js/view-more.js', 'js/view-guide.js', 'js/view-muhurta.js', 'js/calendar.js', 'js/view-janma.js', 'js/sankalpa.js', 'js/view-sankalpa.js', 'js/i18n.js', 'js/view-shannavati.js', 'js/view-info.js',
  'manifest.webmanifest', 'icons/adyatithi.png', 'data/index.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && (NIGHTLY ? k.startsWith(FAMILY) : !k.startsWith('adyatithi-nightly-'))).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (!NIGHTLY && url.pathname.startsWith(NIGHTLY_PATH)) return;
  // Calendar feeds are always fetched fresh: a stale copy would defeat subscribing.
  if (url.pathname.includes('/data/ics/')) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(e.request);
    const fresh = fetch(e.request).then((res) => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    }).catch(() => hit);
    return hit || fresh;
  }));
});
