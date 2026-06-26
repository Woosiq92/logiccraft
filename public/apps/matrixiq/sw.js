/* 매트릭스아이큐 service worker — cache-first.
 * 배포 때마다 CACHE 버전을 올려야 갱신된다 (예: matrixiq-v2). */
const CACHE = 'matrixiq-v10';
const ASSETS = [
  './', './index.html', './app.js', './engine.js', './data.js', './style.css',
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
