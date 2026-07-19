/**
 * QRGenPro service worker.
 * Strategy:
 *  - App shell (HTML, CSS, JS, fonts, icons) -> cache-first, so the
 *    generator works offline after the first visit.
 *  - Everything else -> network-first with cache fallback.
 * Bump CACHE_VERSION whenever a deployed asset changes so old caches
 * are cleared and clients pick up the new files.
 */
const CACHE_VERSION = 'qrgenpro-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/css/w3.css',
  '/css/style.css',
  '/js/qr-code-styling.js',
  '/js/script.js',
  '/site.webmanifest',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/404.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).catch(() => {
      // Non-fatal: individual missing assets shouldn't block install.
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // don't cache third-party requests

  const isAppShell = APP_SHELL.includes(url.pathname);

  if (isAppShell) {
    // Cache-first for the app shell.
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
    return;
  }

  // Network-first for everything else (landing pages, etc.), falling
  // back to cache, then to the offline 404/shell page.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match('/index.html'))
      )
  );
});
