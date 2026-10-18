// Offline support: always try the network first so updates show up straight
// away, and fall back to the cached copy when offline. 'no-cache' makes every
// request check with the server, so the browser's HTTP cache (GitHub Pages
// allows 10 minutes) can't hand back an old script next to a new page.
const CACHE = 'rent-vs-buy-v2';
const FILES = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'src/model.js', 'src/chart.js', 'src/app.js', 'src/shell.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then((cache) =>
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      })
      .catch(() => cache.match(e.request, { ignoreSearch: true }))));
});
