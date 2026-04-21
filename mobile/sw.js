/* ============================================================
   MIDI Chord Runner — Demo Service Worker
   ============================================================ */

// ⬆ Bump this version string on every deploy to bust old caches.
const CACHE_NAME = 'chord-runner-demo-v3';

const SHELL_ASSETS = [
  '/game',
  '/',
  '/engine/style.css',
  '/css/demo.css',
  '/mobile/manifest.json',
  '/mobile/icons/icon-192.png',
  '/mobile/icons/icon-512.png',
  '/mobile/mobile.css',
  '/mobile/pwa.js',
  'https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js',
  '/js/demoConfig.js',
  '/engine/config.js',
  '/engine/chords.js',
  '/js/demoMidi.js',
  '/engine/hud.js',
  '/engine/combat/GameState.js',
  '/engine/combat/MonsterSystem.js',
  '/engine/combat/HealOrb.js',
  '/engine/combat/CombatScene.js',
  '/engine/scenes/BootScene.js',
  '/engine/scenes/GameScene.js',
  '/engine/scenes/UIScene.js',
  '/js/demoMain.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        SHELL_ASSETS.map((url) =>
          cache.add(url).catch((err) =>
            console.warn('[SW-Demo] Failed to cache:', url, err)
          )
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // Network-first for HTML navigation — always serve the freshest page
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Network-first for versioned JS/CSS (?v=...) — always get latest code
  if (url.search.startsWith('?v=')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for everything else (images, fonts, Phaser CDN)
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((res) => {
      if (res && res.status === 200 && res.type !== 'opaque') {
        caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()));
      }
      return res;
    }))
  );
});
