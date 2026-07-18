/**
 * The launcher app — a thin React shell over @rentgen/sdk in three phases:
 * onboarding (permission-priming CTA) → scanning (full-screen camera + glass dock) →
 * review (results + export). Calls configureRentgen() once with the VITE_* keys
 * (the SDK never reads import.meta.env).
 */

import { useEffect, useState } from 'react';
import { configureRentgen, on, preloadDetector, type EnrichedItem } from '@rentgen/sdk';
import './app.css';

// `?stub=1` forces the offline stub adapters — the recorded-fallback / no-wifi demo path.
// `?notavily=1` keeps REAL vision but stubs the pricing (both keys are required for real
// enrichment) — cheap detection testing without burning Tavily/reconcile tokens.
const params = new URLSearchParams(window.location.search);
const stubMode = params.has('stub');
const noTavily = params.has('notavily');

// Rehearsed demo inventory — steadies naming for the products we actually bring on stage.
// Edit freely; remove entries for a "cold" unknown-room demo.
const DEMO_HINTS = [
  'Asus Zenbook S14 laptop',
  'DJI Osmo Pocket 4 gimbal camera',
  'Ray-Ban Meta smart glasses',
  'Nintendo Switch 2 console',
];

configureRentgen({
  openaiApiKey: stubMode ? undefined : import.meta.env.VITE_OPENAI_API_KEY,
  tavilyApiKey: stubMode || noTavily ? undefined : import.meta.env.VITE_TAVILY_API_KEY,
  detectionHints: DEMO_HINTS,
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

type Phase = 'onboarding' | 'scanning' | 'review';

const CATEGORY_ICON: Readonly<Record<string, string>> = {
  Photography: '📷',
  Electronics: '🔌',
  Audio: '🎧',
  Gaming: '🎮',
  Computing: '💻',
  Tools: '🛠️',
  'Sports & Outdoor': '🏕️',
  'Music Instruments': '🎸',
  'Home & Kitchen': '🍳',
  Furniture: '🪑',
};

function Onboarding({ onStart }: { onStart: () => void }) {
  return (
    <div className="onboarding">
      <span className="wordmark">Rentgen</span>
      <h1>
        X-ray your room.
        <br />
        <em>See the idle capital.</em>
      </h1>
      <p className="pitch">
        Film your stuff. Every item gets a live resale and rent-per-day price from real web
        listings — and the total climbs as you pan.
      </p>
      <button className="cta" onClick={onStart}>
        Start scanning
      </button>
      <p className="disclaimer">
        Rentgen needs your camera — your browser will ask for permission when you start. The
        video never leaves your device; only object snapshots are priced.
      </p>
    </div>
  );
}

function ScanStage({
  captured,
  pending,
  onStop,
}: {
  captured: readonly EnrichedItem[];
  pending: number;
  onStop: () => void;
}) {
  const n = captured.length;
  const pillText =
    pending > 0
      ? n === 0
        ? 'Analyzing first find…'
        : `${n} captured · ${pending} analyzing…`
      : n === 0
        ? 'Looking for gadgets…'
        : `${n} gadget${n === 1 ? '' : 's'} captured`;
  // Newest finds first, so a fresh capture is always visible without scrolling.
  const newestFirst = [...captured].reverse();
  return (
    <div className="scan-stage">
      <rentgen-scanner immersive />
      <div className="scan-pill">
        <span className="dot" />
        {pillText}
      </div>
      <div className="scan-dock">
        <div className="capture-card">
          <div className="head">
            <span className="title">Captured</span>
            <span className="count">{n}</span>
            <span className={`state ${n > 0 ? 'live' : ''}`}>
              {n > 0 ? '✓ priced live' : 'Pan slowly'}
            </span>
          </div>
          <div className="chip-row">
            {Array.from({ length: pending }, (_, i) => (
              <span className="chip ghost" key={`pending-${i}`}>
                <span className="icon">✨</span>
                Scanning…
              </span>
            ))}
            {n === 0 && pending === 0 ? (
              <span className="hint">Point the camera at anything worth money.</span>
            ) : (
              newestFirst.map((item) => (
                <span className="chip" key={item.id}>
                  <span className="icon">
                    {item.image ? (
                      <img src={item.image} alt="" />
                    ) : (
                      (CATEGORY_ICON[item.category] ?? '📦')
                    )}
                  </span>
                  {item.name}
                </span>
              ))
            )}
          </div>
          <button className="stop-btn" onClick={onStop}>
            <span className="rec" />
            Stop &amp; review
          </button>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const [phase, setPhase] = useState<Phase>('onboarding');
  const [captured, setCaptured] = useState<readonly EnrichedItem[]>([]);
  const [pending, setPending] = useState(0);

  // Warm the on-device detector (WASM + model) during onboarding, so the moment the
  // user taps "Start scanning" the live detector is already hot.
  useEffect(() => {
    void preloadDetector();
  }, []);

  // The client emits the full accumulated inventory on every scan:complete; scan:start
  // fires the moment a crop is captured — that drives the instant "Scanning…" ghost chip.
  useEffect(() => {
    const offs = [
      on('scan:start', () => setPending((p) => p + 1)),
      on('scan:complete', (result) => {
        setCaptured(result.items);
        setPending((p) => Math.max(0, p - 1));
      }),
      on('scan:error', () => setPending((p) => Math.max(0, p - 1))),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  return (
    <>
      {/* Always mounted (hidden outside review) so the widgets receive bus events live
          during scanning instead of missing them and rendering empty. */}
      <main className="review" style={{ display: phase === 'review' ? undefined : 'none' }}>
        <div className="topbar">
          <button className="back-btn" onClick={() => setPhase('scanning')}>
            ← Scan more
          </button>
          <h1
            style={{ fontSize: '1.4rem', margin: 0, letterSpacing: '-0.02em', color: '#fff' }}
          >
            Rentgen
          </h1>
        </div>
        <rentgen-results>
          <rentgen-upsell />
        </rentgen-results>
      </main>
      {phase === 'onboarding' && <Onboarding onStart={() => setPhase('scanning')} />}
      {phase === 'scanning' && (
        <ScanStage captured={captured} pending={pending} onStop={() => setPhase('review')} />
      )}
    </>
  );
}
