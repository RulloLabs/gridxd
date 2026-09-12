const CACHE_NAME = 'gridxd-v5';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/logo.png',
  '/Grid Neon Sin Fondo.png',
  '/LogoGridXDFAVICON.png',
  '/LogoMainGRIDXD.png',
  '/favicon.ico',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (
    url.pathname.startsWith('/v1/') ||
    url.pathname.includes('/functions/') ||
    url.hostname.includes('supabase.co') ||
    url.pathname.includes('/auth/') ||
    url.hostname.includes('stripe.com') ||
    url.hostname.includes('a.run.app')
  ) {
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        // Never serve a stale application shell after a deployment.
        if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/sw.js') {
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse.ok) cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        }

        return cache.match(event.request).then((cachedResponse) => {
          const fetchedResponse = fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch((err) => {
            console.warn('[SW] Network fetch failed:', err);
            return cachedResponse;
          });

          return cachedResponse || fetchedResponse;
        });
      })
    );
  }
});
