/* Service worker.
   Stratégie « génération atomique » : chaque version place tous ses fichiers
   dans un cache nommé et sert toujours depuis ce cache. Impossible d'obtenir
   l'index.html d'une version avec l'app.js d'une autre — c'est ce panachage
   qui laissait l'application vide.
   Corollaire : CACHE doit être incrémenté à chaque déploiement, sans quoi
   plus rien ne se met à jour. */
const CACHE = 'daily-quest-v7';

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
  // Les fichiers sont téléchargés ensemble : si l'un échoue, la nouvelle
  // génération n'est pas activée et l'ancienne, cohérente, continue de servir.
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
  if (new URL(evt.request.url).origin !== self.location.origin) return;

  evt.respondWith(
    caches.open(CACHE).then((cache) =>
      // ignoreSearch : « index.html?v=3 » doit renvoyer la même génération.
      cache.match(evt.request, { ignoreSearch: true })
        .then((reponse) => reponse || fetch(evt.request))
    )
  );
});
