# app — the Rentgen scanner

The launcher app: a thin React 19 (Vite) shell over
[`@rentgen/sdk`](../../packages/sdk/README.md). It exists to prove the SDK's claim —
all the value-chain logic lives in the SDK; this app only configures and mounts it.

Three phases:

1. **Onboarding** — permission-priming CTA ("X-ray your room").
2. **Scanning** — full-screen `<rentgen-scanner immersive frames>` with a glass dock:
   live progress bar, ghost chips while detection runs, named provisional chips the
   moment the vision model answers, priced chips once enrichment completes.
3. **Review** — `<rentgen-results>` (item cards + totals + selection) with
   `<rentgen-upsell>` (listing-export bundle) slotted inside.

The React side only listens to the SDK's event bus (`scan:start` / `scan:detected` /
`scan:complete` / `scan:error`) to drive chips and phase changes — see
[`src/App.tsx`](src/App.tsx), which is the whole app.

## Run

```bash
npm install        # once, at the repo root
npm run dev        # http://localhost:5173
```

- **Offline demo mode:** append `?stub=1` — deterministic stub adapters, no keys, no
  network. Always works; this is the demo-safe path.
- **Live detection:** `cp .env.example .env` and fill in keys, then restart dev:
  - `VITE_GEMINI_API_KEY` — live-pan frame-batch detection (the default scanner path)
  - `VITE_OPENAI_API_KEY` — single-photo detection

The keys are passed to `configureRentgen()` in `src/App.tsx` — the SDK itself never
reads `import.meta.env`. **Keys end up in the browser bundle** (deliberate demo
trade-off — use disposable, rate-limited keys and rotate them; see
[`SECURITY.md`](../../.github/SECURITY.md)). Never commit `.env`.

Camera capture needs HTTPS or localhost (`getUserMedia`); otherwise the scanner falls
back to photo upload.

## Notable pieces

| Path | What |
|---|---|
| `src/App.tsx` | The entire app: config, phases, event wiring. |
| `src/celebrate.ts` | Discovery feedback — pling sound + money burst on `scan:detected`. |
| `src/app.css` | App-level styling; widget theming via `--rentgen-*` CSS vars only. |
| `public/sw.js`, `public/manifest.webmanifest` | Minimal PWA shell (installable, versioned by build id). |
| `public/test-room.jpg` | A test image for upload-mode smoke tests. |
| `DEMO_HINTS` (in `App.tsx`) | Rehearsed demo inventory passed as `detectionHints` — edit or empty it for a cold demo. |

## Scripts

| Command (from repo root) | What |
|---|---|
| `npm run dev` | Vite dev server with HMR across workspaces. |
| `npm run typecheck` | `tsc --noEmit` (sdk + app). |
| `npm run build` | SDK build + app production build. |
