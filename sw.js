// ============================================================
// Hammad Crypto PWA — Service Worker v3.5
// ============================================================
'use strict';

const CACHE_NAME = 'hammad-crypto-v3';
const ASSETS = [
  '/HammadCrypto/',
  '/HammadCrypto/index.html',
  '/HammadCrypto/app.js',
  '/HammadCrypto/manifest.json',
  '/HammadCrypto/icons/icon128.png',
  '/HammadCrypto/icons/icon192.png',
  '/HammadCrypto/icons/icon512.png',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap'
];

// ---- Install: cache shell ----
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(ASSETS.filter(u => !u.startsWith('http')))
    )
  );
});

// ---- Activate: purge old caches ----
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ---- Fetch: network-first for API, cache-first for assets ----
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API calls — always network, never cache
  if (url.hostname === 'www.okx.com' ||
      url.hostname === 'text.pollinations.ai' ||
      url.hostname === 'api.exchangerate-api.com') {
    return; // let browser handle normally
  }

  // GitHub Pages: handle 404 for SPA navigation
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match('/HammadCrypto/index.html').then(r => r || fetch(e.request))
    );
    return;
  }

  // Static assets: cache-first with network fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('/HammadCrypto/index.html'));
    })
  );
});

// ---- Push Notifications ----
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const opts = {
    body: data.body || 'تحديث من Hammad Crypto',
    icon: '/HammadCrypto/icons/icon192.png',
    badge: '/HammadCrypto/icons/icon48.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'crypto-alert',
    renotify: true,
    data: { url: data.url || '/HammadCrypto/' }
  };
  e.waitUntil(self.registration.showNotification(data.title || 'Hammad Crypto', opts));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || '/HammadCrypto/'));
});

// ---- Background Sync (portfolio refresh) ----
self.addEventListener('message', async e => {
  if (e.data?.type === 'UPDATE_BADGE') {
    const { profit } = e.data;
    if ('setAppBadge' in navigator) {
      if (profit !== undefined && profit !== null) {
        const abs = Math.abs(profit);
        // Badge count = abs profit rounded (up to 99)
        const count = Math.min(99, Math.round(abs));
        try { await self.registration.badge?.set(count); } catch {}
      }
    }
    // Show notification for significant profit/loss change
    const stored = e.data.prevProfit;
    if (stored !== undefined && profit !== undefined) {
      const change = profit - stored;
      if (Math.abs(change) >= 50) {
        const isProfit = change > 0;
        await self.registration.showNotification(
          isProfit ? '🚀 Hammad Crypto — ربح جديد!' : '⚠️ Hammad Crypto — تنبيه',
          {
            body: isProfit
              ? `ارتفع ربحك بمقدار +$${Math.abs(change).toFixed(0)} 💰`
              : `انخفضت محفظتك بمقدار -$${Math.abs(change).toFixed(0)}`,
            icon: '/HammadCrypto/icons/icon192.png',
            badge: '/HammadCrypto/icons/icon48.png',
            vibrate: isProfit ? [100, 50, 100, 50, 200] : [300, 100, 300],
            tag: 'profit-alert',
            renotify: true
          }
        );
      }
    }
  }
});
