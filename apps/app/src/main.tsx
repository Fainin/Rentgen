import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register the service worker so the app is installable as a standalone PWA — and keep
// it current. The `?v=` build id makes each deploy a new script URL, so the browser
// picks up the new version; we then check for updates aggressively and reload once the
// fresh worker takes control, so an already-open PWA lands on the new version fast.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // A real update replaces an existing controller; the first install has none, so
    // don't reload on that initial hand-off.
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register(`/sw.js?v=${__BUILD_ID__}`, { updateViaCache: 'none' })
      .then((registration) => {
        const checkForUpdate = () => registration.update().catch(() => {});
        checkForUpdate();
        // Re-check when the app regains focus and on a slow interval, so a new deploy
        // is noticed without needing a manual refresh.
        window.setInterval(checkForUpdate, 60_000);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkForUpdate();
        });
      })
      .catch(() => {});
  });
}
