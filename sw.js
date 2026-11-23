// Service worker: permite abrir la app sin internet.
// Estrategia "red primero": con internet siempre carga la última versión (no hace falta tocar nada al actualizar);
// sin internet usa la copia guardada.
const CACHE = 'calorias';
const ARCHIVOS = ['./', 'index.html', 'styles.css', 'app.js', 'db.js', 'calc.js', 'alimentos.js',
  'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Las consultas a servicios externos (Open Food Facts, Claude) no se guardan
  if (e.request.method !== 'GET' || url.hostname.endsWith('openfoodfacts.org')) return;
  e.respondWith(
    fetch(e.request)
      .then(resp => {
        if (resp.ok) { const copia = resp.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
        return resp;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
