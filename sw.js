// Hammad Crypto PWA — Service Worker v3.5
const CACHE_NAME = 'hammad-crypto-v3.5';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always network-first for API calls
  if (url.hostname.includes('okx.com') || url.hostname.includes('pollinations.ai') || url.hostname.includes('exchangerate-api.com')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response(JSON.stringify({code:'offline'}), {headers:{'Content-Type':'application/json'}}))
    );
    return;
  }

  // Cache-first for app shell
  if (url.hostname === self.location.hostname) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return res;
      }))
    );
    return;
  }

  // Network-first for everything else
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
