/**
 * The launcher app — currently a bare shell.
 *
 * Once @rentgen/sdk has an implementation, this file calls configureRentgen() and mounts
 * <rentgen-scanner> / <rentgen-results>. For now it's just the headline so `npm run dev`
 * boots to something. See CLAUDE.md for the target.
 */

export function App() {
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
          Point your phone at your stuff. See the idle capital.
        </p>
      </header>

      {/* TODO: <rentgen-scanner /> and <rentgen-results /> once the SDK is implemented. */}
      <p style={{ color: '#9ca3af', marginTop: '2rem', fontSize: '0.9rem' }}>
        Scaffold ready. Build the SDK value chain in <code>packages/sdk</code>, then mount the
        widgets here.
      </p>
    </main>
  );
}
