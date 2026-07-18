import { useEffect, useState } from 'react';
import { configureRentgen } from '@rentgen/sdk';

/**
 * Rentgen launcher — a thin React shell that configures the SDK once with the
 * host app's env keys, then mounts the two self-registering widgets. The value
 * chain (detect → enrich → sellability gate → total → render) lives entirely
 * in @rentgen/sdk.
 *
 * The sellability gate's dropped-item count is surfaced here as an operator-facing
 * notice (not jury-facing) so the honesty filter is visible.
 */
export function App() {
  const [hidden, setHidden] = useState(0);

  useEffect(() => {
    configureRentgen({
      openaiApiKey: import.meta.env.VITE_OPENAI_API_KEY,
      geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY,
      tavilyApiKey: import.meta.env.VITE_TAVILY_API_KEY,
      onHidden: setHidden,
    });
  }, []);

  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '1.5rem 1.25rem 4rem',
        fontFamily: 'system-ui, sans-serif',
        color: '#111827',
      }}
    >
      <header>
        <h1 style={{ fontSize: '2rem', margin: 0, letterSpacing: '-0.02em' }}>Rentgen</h1>
        <p style={{ color: '#6b7280', margin: '0.25rem 0 0' }}>
          Point your phone at your stuff. See what it's worth.
        </p>
      </header>

      <div style={{ marginTop: '1.5rem' }}>
        <rentgen-scanner />
      </div>

      {hidden > 0 && (
        <div
          style={{
            marginTop: '0.75rem',
            fontSize: '0.78rem',
            color: '#92400e',
            background: '#fef3c7',
            borderRadius: 8,
            padding: '0.4rem 0.6rem',
          }}
        >
          {hidden} item{hidden === 1 ? '' : 's'} hidden — not sellable / unpriced (honesty filter).
        </div>
      )}

      <div style={{ marginTop: '1.25rem' }}>
        <rentgen-results />
      </div>
    </main>
  );
}
