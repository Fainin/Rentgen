/**
 * The launcher app — a thin shell that configures the SDK and drops in its widgets.
 * All the real work lives in @rentgen/sdk; this file is just layout + the headline.
 */

import { useEffect, useState } from 'react';
import { configureRentgen, rentgenEvents } from '@rentgen/sdk';
import '@rentgen/sdk'; // registers <rentgen-scanner> / <rentgen-results>

// Configure once, at module load. Missing keys → offline mock data (stub adapters).
configureRentgen({
  openaiApiKey: import.meta.env.VITE_OPENAI_API_KEY,
  tavilyApiKey: import.meta.env.VITE_TAVILY_API_KEY,
});

const offline = !import.meta.env.VITE_OPENAI_API_KEY || !import.meta.env.VITE_TAVILY_API_KEY;

export function App() {
  const [scanned, setScanned] = useState(false);

  useEffect(() => rentgenEvents.on('scan:complete', () => setScanned(true)), []);

  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '1.5rem 1.25rem 4rem',
        fontFamily: 'system-ui, sans-serif',
        color: '#111827',
        // Widget theming — all via CSS custom properties.
        // @ts-expect-error custom properties aren't in the CSSProperties type
        '--rentgen-accent': '#4f46e5',
        '--rentgen-radius': '16px',
      }}
    >
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '2rem', margin: 0, letterSpacing: '-0.02em' }}>Rentgen</h1>
        <p style={{ color: '#6b7280', margin: '0.25rem 0 0' }}>
          {scanned
            ? 'Every room is a marketplace that hasn’t happened yet.'
            : 'Point your phone at your stuff. See the idle capital.'}
        </p>
        {offline && (
          <p style={{ fontSize: '0.8rem', color: '#b45309', marginTop: '0.5rem' }}>
            ⚡ Offline demo mode — showing mock data. Add API keys in <code>.env</code> to go live.
          </p>
        )}
      </header>

      <rentgen-scanner />
      <rentgen-results />
    </main>
  );
}
