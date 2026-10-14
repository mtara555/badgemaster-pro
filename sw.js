/* ============================================================
   BADGEMASTER PRO — Service Worker v7.0
   ============================================================
   Stratégie :
   - Cache-first pour les assets statiques
   - Network-first pour index.html (mise à jour)
   - Fallback offline
   ============================================================ */

const CACHE_NAME  = 'badgemaster-v7.0';
const RUNTIME_CACHE = 'badgemaster-runtime-v7.0';

/* ---------- Assets à pré-cacher lors de l'install ---------- */
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap'
];

/* ============================================================
   INSTALL — Pré-cache
   ============================================================ */
self.addEventListener('install', (event) => {
  console.log('[SW] Installation…');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn('[SW] Échec precache:', url, err.message);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

/* ============================================================
   ACTIVATE — Nettoyage anciens caches
   ============================================================ */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation…');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
            .map((name) => {
              console.log('[SW] Suppression cache obsolète:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

/* ============================================================
   FETCH — Stratégies différenciées
   ============================================================ */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ne gère que GET
  if (request.method !== 'GET') return;

  // Ignore les requêtes chrome-extension, etc.
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  // ---- Stratégie 1 : Network-first pour index.html ----
  if (request.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // ---- Stratégie 2 : Cache-first pour tout le reste ----
  event.respondWith(cacheFirst(request));
});

/* ============================================================
   STRATÉGIES
   ============================================================ */

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === 'basic') {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    console.warn('[SW] Fetch échoué (offline):', request.url);
    return new Response('Ressource indisponible hors-ligne', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Fallback vers index.html offline
    const fallback = await caches.match('./index.html');
    if (fallback) return fallback;

    return new Response('Application hors-ligne', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

/* ============================================================
   MESSAGE — Permet un skipWaiting forcé depuis l'app
   ============================================================ */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
