# Rentgen — build notes (running log)

One lesson per entry. Update entries instead of duplicating; delete ones that prove wrong.

## Tavily browser CORS: WORKS — no fallback needed
Smoke-tested 2026-07-18 (before any enrichment polish, per design §9): OPTIONS preflight
from `Origin: http://localhost:5173` → 200 with `access-control-allow-origin` echoed;
`POST https://api.tavily.com/search` with `Authorization: Bearer <key>` → 200 + results.
Direct browser calls are fine. The transport still lives behind a small `search()` fn in
`enrichment/tavily-comps.ts` in case this changes on the venue network.

## Camera needs HTTPS or localhost (from the krempel prototype)
`getUserMedia` fails with `NotAllowedError` on `http://<lan-ip>` and in in-app browsers.
`<rentgen-scanner>` surfaces a photo-upload fallback so the demo never dead-ends. For
phone testing: real browser + HTTPS (e.g. `vite --host` + a tunnel) or a QR to localhost
forwarding. Test on the venue phone early.

## LLM output is untrusted (carried from prototype)
Both OpenAI adapters use strict JSON schema output AND still parse defensively: drop
missing-name entries, clamp confidence 0..1, drop < 0.3, strip `<>` + cap string length,
cap 12 items/scan. Never trust the schema alone.

## Prices are clamped deterministically (carried from prototype)
The model emits NaN/Infinity/absurd numbers eventually. Enrichment validates after parse:
`Number.isFinite` guard, swap inverted min/max, floor 1, cap 1M, rent-band sanity
(rent fallback = 1.5–3%/day of resale midpoint when rental comps are empty).

## AbortSignal.timeout on every external call (carried from prototype)
OpenAI vision 45s, Tavily 15s, reconcile 30s. A hung fetch must never hang the demo.

## Secret scan before any public push
Real keys live only in `apps/app/.env` (gitignored — verify before push). Rotate both
keys after the event; they are demo-scoped and embedded in the browser bundle by design.

## Seam registry edits made (all pre-sanctioned, synced in workstreams README)
`EnrichedItem.image?` · `selection:change` event · `rentgen-report-card` tag ·
`configureRentgen` forwards the opaque `asset` blob to `createAssetAdapter`.

## Event-emission split
`scan:start` is emitted by the SCANNER (before calling scan()); `scan:complete` /
`scan:error` by RentgenClient. Don't add a second `scan:start` in the client — widgets
would double-react.

## Grounding hazards found live (enrichment)
Two real failure modes surfaced in live testing, both now handled in `tavily-comps.ts`:
1. **Name collision:** "Sony a7 III" matched *Audi A7* eBay listings. Fix: category added
   to the resale query as a disambiguator + `search_depth: 'advanced'`.
2. **Wrong product class in rentals:** a €4 paper notebook matched *laptop rental* sites →
   rent €30/day > resale. Fix: rent-vs-resale sanity clamp — if reconciled rent/day
   exceeds ~8–10% of the resale midpoint, discard the rental comps and fall back to the
   derived 1.5–3%/day band. (The model returning `{0,0}` when comps are useless is treated
   as a hard throw, never clamped to a fake €1.)

## Verified live in-browser (real keys, 2026-07-18 ~16:05)
Full chain in an actual browser page: OpenAI vision (4 objects from a real desk photo) →
Tavily comps + reconcile → grounded prices with real source URLs (mac-store24 used-MacBook
listings for the MacBook Pro) → €643 total. Tavily CORS confirmed in-browser, not just in
the Node preflight. Single-item enrich ~3.4–7.5 s (inside the <8 s target).

## Verified live in-browser (stub path, 2026-07-18 ~16:00)
Scan → 4 cards + animated €-total → rehearsal re-scan 0 ms cache hit (same sessionId) →
uncheck in `<rentgen-results>` updates `<rentgen-upsell>` ("3 selected · 210 €/wk") via the
`selection:change` bus event. OpenAI vision adapter separately live-verified against the
real API (4 correct objects from a desk photo).

## wmux browser can't do camera/file-picker
Headless-panel smoke tests drive the scanner via
`document.querySelector('rentgen-scanner').runScan(dataUrl)` (TS-private, runtime-public)
and fetch test images from `apps/app/public/` — data URLs are too big for eval args.

## sideEffects in packages/sdk/package.json
Was `false`; widget self-registration would be tree-shaken out of production app builds.
Now an allowlist (`rentgen-*.ts`, `index.ts`, `dist/**`). If a widget ever "disappears"
in a build, check this first.
