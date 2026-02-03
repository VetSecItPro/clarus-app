// Service Worker — offline fallback only
// IMPORTANT: Do NOT cache HTML pages. Vercel deployments change asset hashes
// on every deploy, so cached HTML references stale JS/CSS that no longer exists.
// This causes RSC payload failures and CSS preload mismatches.
const CACHE_NAME = 'clarus-v2';

// Only cache the offline fallback — the one truly static asset
const PRECACHE_ASSETS = [
  '/offline.html',
];

// Install event - cache only the offline fallback
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean ALL old caches (including stale v1 caches)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network-first for everything, offline fallback for navigation
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Only intercept navigation requests (page loads) for offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/offline.html');
      })
    );
    return;
  }

  // Let all other requests (JS, CSS, images, API) go directly to the network.
  // Vercel's CDN + browser cache handle caching far better than a SW for
  // deployment-hashed assets.
});

// Handle messages from main thread
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
