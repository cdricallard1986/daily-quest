/* Service worker : met l'app en cache pour un fonctionnement hors-ligne.
   Bumper CACHE à chaque déploiement pour forcer la mise à jour. */
const CACHE = 'daily-quest-v5';

const FICHIERS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FICHIERS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evt) => {
  if (evt.request.method !== 'GET') return;
  evt.respondWith(
    // Réseau d'abord (pour récupérer les mises à jour), cache en secours.
    fetch(evt.request)
      .then((reponse) => {
        const copie = reponse.clone();
        caches.open(CACHE).then((c) => c.put(evt.request, copie)).catch(() => {});
        return reponse;
      })
      .catch(() => caches.match(evt.request).then((r) => r || caches.match('./index.html')))
  );
});
