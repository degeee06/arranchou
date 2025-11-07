const CACHE_NAME = 'arranchou-cache-v2'; // Incremented cache version
const urlsToCache = [
  '/',
  '/index.html',
  '/icon.svg',
  '/manifest.json'
];

// Install the service worker and cache the essential app assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching assets');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate event to clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Network-first fetch strategy
self.addEventListener('fetch', event => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    // Try the network first
    fetch(event.request)
      .then(res => {
        // If the fetch is successful, clone the response and cache it
        const resClone = res.clone();
        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(event.request, resClone);
          });
        return res;
      })
      // If the network fails, fall back to the cache
      .catch(err => {
        console.log(`Network failed for ${event.request.url}, falling back to cache.`);
        return caches.match(event.request).then(response => response || Promise.reject('no-match'));
      })
  );
});