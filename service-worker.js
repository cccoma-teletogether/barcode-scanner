// Service Worker - 오프라인 지원 및 캐싱
const CACHE_NAME = 'barcode-scanner-v1';
const WASM_CACHE_NAME = 'barcode-scanner-wasm-v1';

// 캐시할 파일 목록
const URLS_TO_CACHE = [
  '/',
  '/barcode_scanner.html',
  '/manifest.json',
  '/service-worker.js'
];

// WASM 파일 URL (CDN)
const WASM_URLS = [
  'https://cdn.jsdelivr.net/npm/zxing-wasm@0.2.4/dist/iife/reader/index.js',
  'https://fastly.jsdelivr.net/npm/zxing-wasm@0.2.4/dist/reader/index.wasm'
];

// Service Worker 설치
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(URLS_TO_CACHE);
      })
      .then(() => {
        // WASM 파일도 캐시 (실패해도 계속 진행)
        return caches.open(WASM_CACHE_NAME)
          .then(cache => {
            return Promise.allSettled(
              WASM_URLS.map(url => 
                fetch(url)
                  .then(response => {
                    if (response.ok) {
                      return cache.put(url, response);
                    }
                  })
                  .catch(err => console.log(`[Service Worker] Failed to cache ${url}:`, err))
              )
            );
          });
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error('[Service Worker] Installation failed:', err))
  );
});

// Service Worker 활성화
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => {
              return cacheName !== CACHE_NAME && cacheName !== WASM_CACHE_NAME;
            })
            .map(cacheName => {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// 요청 처리
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // WASM 파일 요청
  if (WASM_URLS.some(wasm_url => request.url.includes(wasm_url))) {
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            console.log('[Service Worker] Returning cached WASM:', request.url);
            return response;
          }
          
          return fetch(request)
            .then(response => {
              // 성공한 응답만 캐시
              if (response && response.status === 200) {
                const responseToCache = response.clone();
                caches.open(WASM_CACHE_NAME)
                  .then(cache => {
                    cache.put(request, responseToCache);
                  });
              }
              return response;
            })
            .catch(err => {
              console.error('[Service Worker] Fetch failed:', request.url, err);
              // WASM 로드 실패 시 캐시된 버전 반환
              return caches.match(request)
                .then(cachedResponse => {
                  if (cachedResponse) {
                    return cachedResponse;
                  }
                  // 캐시도 없으면 오류 응답
                  return new Response('Network request failed and no cache available', {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: new Headers({
                      'Content-Type': 'text/plain'
                    })
                  });
                });
            });
        })
    );
    return;
  }

  // 로컬 파일 요청 (HTML, CSS, JS 등)
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            console.log('[Service Worker] Returning cached:', request.url);
            return response;
          }

          return fetch(request)
            .then(response => {
              // 성공한 응답만 캐시
              if (response && response.status === 200 && request.method === 'GET') {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME)
                  .then(cache => {
                    cache.put(request, responseToCache);
                  });
              }
              return response;
            })
            .catch(err => {
              console.error('[Service Worker] Fetch failed:', request.url, err);
              
              // 오프라인 상태에서 캐시된 응답 반환
              return caches.match(request)
                .then(cachedResponse => {
                  if (cachedResponse) {
                    return cachedResponse;
                  }
                  
                  // 캐시도 없으면 오프라인 페이지 반환
                  if (request.destination === 'document') {
                    return caches.match('/barcode_scanner.html');
                  }
                  
                  return new Response('Network request failed', {
                    status: 503,
                    statusText: 'Service Unavailable'
                  });
                });
            });
        })
    );
    return;
  }

  // 외부 요청 (CDN 등)
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(WASM_CACHE_NAME)
            .then(cache => {
              cache.put(request, responseToCache);
            });
        }
        return response;
      })
      .catch(err => {
        console.error('[Service Worker] External fetch failed:', request.url, err);
        return caches.match(request)
          .catch(() => {
            return new Response('Network request failed', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// 백그라운드 동기 (선택사항)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-results') {
    event.waitUntil(
      // 스캔 결과 동기화 로직 (필요시 구현)
      Promise.resolve()
    );
  }
});

// 메시지 처리
self.addEventListener('message', event => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
