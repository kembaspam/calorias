// Service worker: permite abrir la app sin internet.
// Estrategia "red primero": con internet siempre carga la última versión (no hace falta tocar nada al actualizar);
// sin internet usa la copia guardada.
const CACHE = 'calorias';
const ARCHIVOS = ['./', 'index.html', 'styles.css', 'app.js', 'db.js', 'calc.js', 'alimentos.js', 'ia.js', 'graficas.js',
  'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  // Solo se guardan las descargas normales (las consultas a Claude son POST y no se tocan)
  if (e.request.method !== 'GET') return;
  e.respondWith(
    // no-cache: pregunta siempre al servidor si hay versión nueva (GitHub deja copias viejas 10 min si no)
    fetch(e.request, { cache: 'no-cache' })
      .then(resp => {
        if (resp.ok) { const copia = resp.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
        return resp;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
