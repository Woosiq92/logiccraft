/* 첫믹스 service worker — cache-first.
 * 배포 때마다 아래 CACHE 버전의 숫자를 올려야 갱신된다.
 * 이 주석에 버전 문자열을 예시로 적지 말 것. 문자열 치환으로 버전을 올리다 보면
 * 주석 쪽이 먼저 걸려서 상수는 그대로 남는다(실제로 v2 에 멈춰 있었다).
 * tests/smoke.js 가 파일 안에 버전 문자열이 하나뿐인지 확인한다. */
const CACHE = 'firstmix-v16';
// addAll 은 하나만 404 여도 통째로 거부한다 = 서비스워커 설치 실패. 목록을 실제 파일과 맞출 것.
const ASSETS = [
  './', './index.html', './i18n.js', './app.js', './style.css',
  './audio/engine.js', './audio/keylock-worklet.js', './audio/tracks.js', './audio/bpm.js', './audio/library.js', './audio/daily.js',
  './ui/deck.js', './ui/train.js', './ui/daily.js', './ui/guide.js', './ui/learn.js',
  './manifest.json', './icon.svg', './assets/icon-192.png', './assets/icon-512.png',
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
