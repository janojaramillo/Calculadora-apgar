// sw.js — Calculadora APGAR Neonatal
// Dr. Jano Jaramillo · 2026
// Cache-first con actualización en background (Stale-While-Revalidate)

const CACHE_NAME = 'apgar-v1';

// Todos los recursos que necesita la app para funcionar sin internet
const PRECACHE_URLS = [
  './',
  './index.html',
  // Google Fonts — se cachean en la primera visita con internet
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Source+Sans+3:wght@300;400;600&display=swap',
  'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFiD-vYSZviVYUb_rj3ij__anPXDTzYh0c2.woff2',
  'https://fonts.gstatic.com/s/sourcesans3/v15/nwpBtKy2OAdR1K-IwhWudF-R9QMylBJAV3Bo8Kw.woff2'
];

// ─── INSTALL: precachear assets esenciales ───────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // El index.html y ./ siempre se cachean; las fuentes pueden fallar sin internet
      return cache.addAll(['./', './index.html']).then(() => {
        // Intentar cachear fuentes — silenciamos error si no hay red
        return cache.addAll(PRECACHE_URLS.slice(2)).catch(() => {});
      });
    }).then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE: limpiar caches viejas ─────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── FETCH: estrategia por tipo de recurso ───────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Solo manejamos GET
  if (event.request.method !== 'GET') return;

  // Fuentes de Google: Cache-first (no cambian)
  if (url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com') {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // App shell (index.html y raíz): Network-first con fallback a cache
  // Esto garantiza que siempre tenga la versión más reciente con internet,
  // y la versión cacheada cuando está offline
  if (url.pathname === '/' || url.pathname.endsWith('index.html') || url.pathname.endsWith('/')) {
    event.respondWith(networkFirstWithCache(event.request));
    return;
  }

  // Todo lo demás: Cache-first
  event.respondWith(cacheFirst(event.request));
});

// ─── Helpers de estrategia ───────────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Sin red y sin cache: devolver respuesta vacía controlada
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirstWithCache(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response('', { status: 503, statusText: 'Offline' });
  }
}
