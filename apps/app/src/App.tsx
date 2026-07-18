/**
 * The launcher app — a thin React shell over @rentgen/sdk in three phases:
 * onboarding (permission-priming CTA) → scanning (full-screen camera + glass dock) →
 * review (results + export). Calls configureRentgen() once with the VITE_* keys
 * (the SDK never reads import.meta.env).
 */

import { useEffect, useRef, useState } from 'react';
import { configureRentgen, on, type EnrichedItem } from '@rentgen/sdk';
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
  // Gemini drives detection (frame-batch capable — required by the scanner's frames mode);
  // the OpenAI key stays for the enrichment reconcile step.
  geminiApiKey: stubMode ? undefined : import.meta.env.VITE_GEMINI_API_KEY,
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

const MAX_SCAN_FRAMES = 10; // mirrors the scanner's 15 s cap (10 frames · 1.5 s)

interface ProvisionalItem {
  readonly name: string;
  readonly category: string;
}

function ScanStage({
  captured,
  provisional,
  frameCount,
  pending,
  analyzing,
  onStop,
}: {
  captured: readonly EnrichedItem[];
  provisional: readonly ProvisionalItem[];
  frameCount: number;
  pending: number;
  analyzing: boolean;
  onStop: () => void;
}) {
  // The scanner ends filming at the 15 s budget itself — run the same stop flow then.
  useEffect(() => {
    const onTimeup = () => onStop();
    window.addEventListener('rentgen-timeup', onTimeup);
    return () => window.removeEventListener('rentgen-timeup', onTimeup);
  }, [onStop]);

  const n = captured.length;
  const secondsLeft = Math.max(0, Math.round((MAX_SCAN_FRAMES - frameCount) * 1.5));
  const pillText = analyzing
    ? 'Finishing up…'
    : frameCount > 0
      ? `Filming · ${secondsLeft}s left`
      : 'Filming… pan slowly across your things';
  // Newest finds first, so a fresh capture is always visible without scrolling.
  const newestFirst = [...captured].reverse();
  return (
    <div className="scan-stage">
      <rentgen-scanner immersive frames />
      <div className="scan-pill">
        <span className="dot" />
        {pillText}
      </div>
      <div className="scan-dock">
        <div className="capture-card">
          <div className="head">
            <span className="title">Captured</span>
            <span className="count">{n}</span>
            <span className={`state ${n > 0 || pending > 0 ? 'live' : ''}`}>
              {analyzing ? '✨ finishing' : n > 0 ? '✓ priced live' : 'Pan slowly'}
            </span>
          </div>
          <div className="scan-progress">
            <div
              className="bar"
              style={{ width: `${Math.min(100, (frameCount / MAX_SCAN_FRAMES) * 100)}%` }}
            />
          </div>
          <div className="chip-row">
            {Array.from({ length: pending }, (_, i) => (
              <span className="chip ghost" key={`pending-${i}`}>
                <span className="icon">✨</span>
                Identifying…
              </span>
            ))}
            {provisional.map((item) => (
              <span className="chip provisional" key={`prov-${item.name}`}>
                <span className="icon">{CATEGORY_ICON[item.category] ?? '📦'}</span>
                {item.name}
              </span>
            ))}
            {n === 0 && pending === 0 && provisional.length === 0 ? (
              <span className="hint">Film everything worth money, then stop.</span>
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
          <button className="stop-btn" onClick={onStop} disabled={analyzing}>
            <span className="rec" />
            {analyzing ? 'Analyzing…' : 'Stop & review'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const [phase, setPhase] = useState<Phase>('onboarding');
  const [captured, setCaptured] = useState<readonly EnrichedItem[]>([]);
  const [provisional, setProvisional] = useState<readonly ProvisionalItem[]>([]);
  const [frameCount, setFrameCount] = useState(0);
  const [pending, setPending] = useState(0);
  const [detectedPending, setDetectedPending] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const stoppingRef = useRef(false);

  // Pipelined frame flow: the scanner streams keyframe chunks to the model WHILE
  // filming. Two-stage feedback: scan:detected shows the NAMED find the moment the
  // vision model answers (provisional chip); scan:complete swaps it for the priced
  // item. Ghost chips cover only chunks whose detection hasn't answered yet.
  useEffect(() => {
    const onFrames = (event: Event) =>
      setFrameCount((event as CustomEvent<{ count: number }>).detail.count);
    window.addEventListener('rentgen-frames', onFrames);
    const offs = [
      on('scan:start', () => setPending((p) => p + 1)),
      on('scan:detected', ({ objects }) => {
        setDetectedPending((d) => d + 1);
        setProvisional((prev) => {
          const have = new Set(prev.map((p) => p.name.toLowerCase()));
          const fresh = objects.filter((o) => !have.has(o.name.toLowerCase()));
          return [
            ...fresh.map((o) => ({ name: o.name, category: o.category })),
            ...prev,
          ];
        });
      }),
      on('scan:complete', (result) => {
        setCaptured(result.items);
        const priced = new Set(result.items.map((i) => i.name.trim().toLowerCase()));
        setProvisional((prev) => prev.filter((p) => !priced.has(p.name.trim().toLowerCase())));
        setPending((p) => Math.max(0, p - 1));
        setDetectedPending((d) => Math.max(0, d - 1));
      }),
      on('scan:error', () => {
        setPending((p) => Math.max(0, p - 1));
        setDetectedPending((d) => Math.max(0, d - 1));
        setProvisional([]); // failed chunk — don't leave orphaned name chips
      }),
    ];
    return () => {
      window.removeEventListener('rentgen-frames', onFrames);
      offs.forEach((off) => off());
    };
  }, []);

  const onStop = async () => {
    if (stoppingRef.current) return; // stop button and 15 s time-up can race
    const scanner = document.querySelector('rentgen-scanner') as
      | (HTMLElement & { finishFrames(): Promise<void> })
      | null;
    if (!scanner) return;
    stoppingRef.current = true;
    setAnalyzing(true);
    try {
      await scanner.finishFrames();
    } finally {
      stoppingRef.current = false;
      setAnalyzing(false);
      setPhase('review');
    }
  };

  return (
    <>
      {/* Always mounted (hidden outside review) so the widgets receive bus events live
          during scanning instead of missing them and rendering empty. */}
      <main className="review" style={{ display: phase === 'review' ? undefined : 'none' }}>
        <div className="topbar">
          <button
            className="back-btn"
            onClick={() => {
              setFrameCount(0);
              setPhase('scanning');
            }}
          >
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
        <ScanStage
          captured={captured}
          provisional={provisional}
          frameCount={frameCount}
          pending={Math.max(0, pending - detectedPending)}
          analyzing={analyzing}
          onStop={onStop}
        />
      )}
    </>
  );
}
