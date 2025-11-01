const CACHE_NAME = 'arranchou-cache-v1';
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/index.tsx',
  '/manifest.json',
  '/icon.svg'
];
const CDN_ORIGINS = [
    'https://cdn.tailwindcss.com',
    'https://aistudiocdn.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      return cache.addAll(APP_SHELL_URLS).catch(err => {
        console.error('Failed to cache app shell:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Stale-While-Revalidate for CDN assets
  if (CDN_ORIGINS.some(origin => requestUrl.origin === origin)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          }).catch(err => {
            console.error('Fetch failed:', requestUrl.href, err);
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Cache-first for app shell assets. Fallback to network.
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
