/* 난제도감 service worker — cache-first.
 * 배포 때마다 CACHE 버전을 올려야 갱신된다 (예: nanje-dogam-v2). */
const CACHE = 'nanje-dogam-v2';
const ASSETS = [
  './', './index.html', './app.js', './graph.js', './style.css',
  './data/meta.js', './data/problems.js', './data/index-corpus.js',
  './manifest.json', './icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request))
  );
});
