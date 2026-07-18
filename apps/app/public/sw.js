// Minimal service worker — its only job is to make the app installable.
// Chrome's install criteria require a registered SW with a fetch handler.
// We intentionally keep it a pass-through (no precache) so the hackathon demo
// never serves a stale bundle; requests fall through to the network.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
