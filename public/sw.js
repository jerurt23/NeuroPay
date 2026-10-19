/**
 * Service worker de NEUROPAY.
 *
 * Su trabajo es uno solo: que la app abra aunque no haya internet.
 * Los datos viven en localStorage/IndexedDB (src/lib/localDb.ts), así que aquí
 * solo nos aseguramos de tener la "cáscara" (index.html, JS, CSS e íconos).
 *
 * Estrategia:
 * - Navegaciones (abrir la app): primero la red, y si no hay, el index.html
 *   guardado. Se pide a la red sin caché para no quedarnos con una versión vieja.
 * - Archivos con hash (JS/CSS/worker del PDF): primero la caché. Son
 *   inmutables, no cambian nunca con la misma dirección.
 * - Cosas de otros dominios (Google): se dejan pasar, no se guardan.
 */

const VERSION = 'v1';
const SHELL = `neuropay-shell-${VERSION}`;
const RUNTIME = `neuropay-runtime-${VERSION}`;

/** Lo mínimo que hace falta para que la app arranque. */
const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // 'reload' salta la caché del navegador para no guardar una copia vieja.
      .then((cache) => cache.addAll(SHELL_URLS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      // Borra las cachés de versiones anteriores.
      .then((keys) => Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Solo nos hacemos cargo de nuestra propia web. Google (GIS), etc., pasan de largo.
  if (url.origin !== self.location.origin) return;

  // Abrir la app o ir a una vista: red primero, y si falla, la cáscara guardada.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then((response) => {
          const copia = response.clone();
          caches.open(RUNTIME).then((cache) => cache.put('/index.html', copia));
          return response;
        })
        .catch(() => caches.match('/index.html', { ignoreSearch: true }).then((r) => r || caches.match('/')))
    );
    return;
  }

  // Assets con hash: primero la caché, si no está, la red y la guardamos.
  event.respondWith(
    caches.match(request).then(
      (guardado) =>
        guardado ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copia = response.clone();
            caches.open(RUNTIME).then((cache) => cache.put(request, copia));
          }
          return response;
        })
    )
  );
});
