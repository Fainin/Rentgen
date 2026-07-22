// Self-updating service worker — makes the app installable AND keeps installed PWAs
// on the newest deploy without waiting for tabs to close.
//
// The app registers this at `/sw.js?v=<BUILD_ID>`, so every deploy is a new script URL:
// the browser installs it, we skipWaiting() + clients.claim() to take over immediately,
// and the page reloads (see main.tsx) onto the fresh version.
//
// Strategy is network-first for same-origin GETs: online users always get the latest
// bytes (never a stale bundle), while the cache is only a fallback so the demo still
// opens on flaky venue wifi. API calls (cross-origin / non-GET) always hit the network.

const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = `rentgen-${VERSION}`;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from every previous build so nothing stale lingers.
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // Only same-origin GETs are cacheable; let everything else (API POSTs, cross-origin
  // OpenAI/Tavily calls, fonts) go straight to the network untouched.
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = (await cache.match('/index.html')) || (await cache.match('/'));
      if (shell) return shell;
    }
    throw error;
  }
}
