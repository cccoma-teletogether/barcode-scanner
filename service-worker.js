// CGMMgr Service Worker — 네트워크 우선, 실패 시 캐시 fallback
const CACHE_NAME = 'cgmmgr-v1';
const PRECACHE_URLS = [
  './cgm-manager.html',
  'https://cdn.jsdelivr.net/npm/zxing-wasm@2.2.0/dist/iife/reader/index.js',
  'https://cdn.jsdelivr.net/npm/@zxing/library@0.23.0/umd/index.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 정상 응답이면 캐시 갱신
        if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
