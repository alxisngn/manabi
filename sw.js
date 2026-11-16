const V = 'v19';
const CACHE = `manabi-${V}`;
const FONT_CACHE = `manabi-fonts-${V}`;

const CORE_ASSETS = [
  './',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/screens.css',
  './css/utilities.css',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './index.html',
  './js/app.js',
  './js/core/nav.js',
  './js/core/progress.js',
  './js/core/ruby.js',
  './js/core/store.js',
  './js/core/tts.js',
  './js/core/util.js',
  './js/core/kana.js',
  './js/core/weak.js',
  './js/modules/vocab/flashcard.js',
  './js/modules/vocab/importer.js',
  './js/modules/vocab/kanji-read.js',
  './js/modules/vocab/match.js',
  './js/modules/vocab/picker.js',
  './js/modules/vocab/quiz.js',
  './js/modules/vocab/reflex.js',
  './js/modules/vocab/quiz/index.js',
  './js/modules/vocab/quiz/build.js',
  './js/modules/vocab/quiz/choice.js',
  './js/modules/vocab/quiz/pairs.js',
  './js/modules/vocab/quiz/typing.js',
  './js/modules/vocab/quiz/gate.js',
  './js/modules/vocab/quiz/result.js',
  './js/modules/vocab/picker/index.js',
  './js/modules/vocab/picker/data.js',
  './js/modules/vocab/picker/views.js',
  './js/modules/vocab/picker/lessonList.js',
  './js/modules/vocab/picker/modeMenu.js',
  './js/screens/exam.js',
  './js/screens/learn.js',
  './js/screens/me.js',
  './js/screens/progress.js',
  './js/screens/today.js',
  './manifest.webmanifest'
];

const toLocalUrl = (p) => (p.startsWith('./') || p.startsWith('/') ? p : `./${p}`);

async function precacheAll() {
  const cache = await caches.open(CACHE);
  await Promise.allSettled(CORE_ASSETS.map((url) => cache.add(url)));

  try {
    const res = await fetch('./data/files.json');
    if (res && res.ok) {
      const json = await res.json();
      const files = Array.isArray(json) ? json : (Array.isArray(json?.files) ? json.files : []);
      await Promise.allSettled(files.map((f) => cache.add(toLocalUrl(String(f)))));
    }
  } catch {}
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAll().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('manabi-') && k !== CACHE && k !== FONT_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put('./index.html', clone));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((res) => {
            if (res && res.ok) cache.put(event.request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(event.request).then((cached) => {
        const networkFetch = fetch(event.request)
          .then((res) => {
            if (res && res.ok) cache.put(event.request, res.clone());
            return res;
          })
          .catch(() => cached);

        return cached || networkFetch;
      })
    )
  );
});