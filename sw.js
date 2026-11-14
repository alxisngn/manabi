const V = 'v1';
const CACHE = `manabi-${V}`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/core/store.js',
  './js/core/util.js',
  './js/core/ruby.js',
  './js/core/tts.js',
  './js/modules/vocab/picker.js',
  './js/modules/vocab/importer.js',
  './js/modules/vocab/flashcard.js',
  './js/modules/vocab/match.js',
  './js/modules/vocab/quiz.js',
  './js/modules/vocab/reflex.js',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  './data/vocab/index.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('manabi-') && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});