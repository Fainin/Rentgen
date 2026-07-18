/**
 * The launcher app — a thin React shell. Calls configureRentgen() once with the
 * VITE_* keys (the SDK never reads import.meta.env), then just mounts the widgets.
 */

import { configureRentgen } from '@rentgen/sdk';

// `?stub=1` forces the offline stub adapters — the recorded-fallback / no-wifi demo path.
const stubMode = new URLSearchParams(window.location.search).has('stub');

configureRentgen({
  openaiApiKey: stubMode ? undefined : import.meta.env.VITE_OPENAI_API_KEY,
  tavilyApiKey: stubMode ? undefined : import.meta.env.VITE_TAVILY_API_KEY,
  currency: 'EUR',
  asset: {
    auth: { isAuthenticated: true, user: { id: 'demo-host-user', displayName: 'Demo' } },
    actions: [
      {
        id: 'download-bundle',
        label: 'Download bundle',
        run(bundle: unknown) {
          const blob = new Blob([JSON.stringify(bundle, null, 2)], {
            type: 'application/json',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'rentgen-export.json';
          a.click();
          URL.revokeObjectURL(url);
        },
      },
    ],
  },
});

export function App() {
  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '1.25rem 1rem 5rem',
        fontFamily: 'var(--rentgen-font)',
      }}
    >
      <header style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.8rem', margin: 0, letterSpacing: '-0.02em', color: '#fff' }}>
          Rentgen
        </h1>
        <p style={{ color: '#9ca3af', margin: '0.25rem 0 0', fontSize: '0.95rem' }}>
          Point your phone at your stuff. See the idle capital.
        </p>
      </header>

      <rentgen-scanner />
      <div style={{ marginTop: '1rem' }}>
        <rentgen-results>
          <rentgen-upsell />
        </rentgen-results>
      </div>
    </main>
  );
}
