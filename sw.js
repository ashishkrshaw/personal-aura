const CACHE_NAME = 'aura-cache-v1';

// This is a minimal service worker to make the app installable and provide a basic offline fallback.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache the main page shell. Other assets are cached dynamically.
      return cache.add('/index.html');
    })
  );
});

self.addEventListener('fetch', event => {
  // We only want to handle GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  // For navigation requests (loading the page), use a network-first strategy.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // If the network fails, serve the cached index.html.
        return caches.match('/index.html');
      })
    );
    return;
  }

  // For all other requests (assets, etc.), use a cache-first strategy.
  // This is good for static assets. Dynamic API calls will still go through if not cached.
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // Return the cached response if it exists.
      if (cachedResponse) {
        return cachedResponse;
      }

      // If not in cache, fetch from the network.
      return fetch(event.request).then(networkResponse => {
        // Don't cache unsuccessful responses or cross-origin scripts from CDNs without care.
        // We will only cache same-origin 'basic' type responses.
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // Clone the response stream.
        const responseToCache = networkResponse.clone();

        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});

// Clean up old caches on activation.
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
