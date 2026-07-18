# Rentgen — build notes (running log)

One lesson per entry. Update entries instead of duplicating; delete ones that prove wrong.

## Detection pivot: Gemini frame-batch beats detector+crops (2026-07-18 ~18:45, SHIPPED)
The MediaPipe→crop→classify pipeline underperformed because EfficientDet only knows 80
COCO classes — a DJI Osmo or smart glasses often never got a box, so they were never even
classified. Pivoted to the krempel pattern: sample a full keyframe every 1.5 s (max 12)
while filming, send ALL frames in ONE `gemini-flash-latest` call; the model dedupes the
same object across frames itself and returns `bestFrameIndex` + `box` per item for card
crops. E2E on the demo video: exactly the 4 target products by exact hint name, no junk.
Gotchas: latest Flash **thinks by default** — a 1.8 s call became a 60 s timeout until
`thinkingConfig: { thinkingBudget: 0 }`; `gemini-flash-lite-latest` is the faster dial.
Seam edits (additive): `DetectionAdapter.detectBatch?`, `DetectedObject.frameIndex?`,
scanner `frames` attribute + bubbling `rentgen-frames` count event, `RentgenClient.scanFrames`.
The old live/tap modes still work; the app now runs frames mode.

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

## Vercel deploy: always via `npm run deploy` (link before deploy)
The app deploys as a prebuilt static site (keys are baked in at build time — no Vercel
env config). `vite build` wipes `dist/`, including the `.vercel/` project link, so a bare
`vercel deploy --cwd apps/app/dist` after a rebuild silently creates a NEW project named
"dist". `npm run deploy` re-links to the `rentgen` project every time. Public URL:
https://rentgen-five.vercel.app (the team-scoped aliases sit behind Vercel SSO). A stray
empty "dist" project may exist in the dashboard — safe to delete by hand.

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

## Video-verified: hints + nano find the exact demo products (2026-07-18 ~18:05)
Real phone video (Zenbook S14 → DJI Osmo Pocket 4 → Ray-Ban Meta → Switch 2) through the
full live pipeline (real vision, `?notavily=1` stub pricing):
- WITHOUT hints (gpt-4.1): all 4 products found but fragmented/misbranded — 15 items,
  laptop appeared 6× as "Surface/HP/MacBook", Switch 2 misread as "Valve Steam Deck".
- WITH `detectionHints` (demo inventory in App.tsx) + gpt-4.1-nano: exactly the target
  inventory by EXACT name, 5 items, junk gone. Hints also make names angle-stable, which
  is what lets the name-dedup merge correctly.
Vision latency: gpt-4.1-nano 0.9–1.3s (new default) vs mini ~1.4s vs gpt-4.1 2.2–3.9s.
Test rig: seek-stepped video → canvas.captureStream (panel blocks video.play()).
`preloadDetector()` runs during onboarding — detector ready in ~170ms at scan start.

## Detection tuned for listing quality (2026-07-18 ~17:10)
"Too many things at once, especially bottles." Three-layer fix:
1. **Detector (capture):** score threshold 0.25 → 0.4, max results 20 → 10, boxes under
   2% of the frame ignored, and a COCO junk-class denylist (bottle, cup, dishes, food,
   plants, appliances — and `person`, as a privacy line) filtered before tracking.
2. **Scan gate:** max 3 crops classify/price concurrently; further confirmed tracks wait
   (they stay confirmed and retry next tick — a natural queue).
3. **Classifier:** min confidence 0.3 → 0.8 (configurable: `detectionMinConfidence`),
   plus prompt rules — only ≥80%-sure items, skip low-value clutter (bottles/cups/
   stationery/food/deco) and anything clearly under ~€15 resale.
Verified: the desk photo that yielded 4–6 objects incl. pencil/ruler junk now returns
exactly "Apple MacBook Pro" (0.98); the live pipeline still captures real objects.

## Vision models upgraded: gpt-4o → gpt-4.1, reconcile → gpt-4.1-mini
gpt-4o (2024) read crops too weakly. gpt-4.1 (default, config-overridable string) names
crops specifically ("Apple wireless keyboard", "black hardcover notebook") AND is faster
(~2.2s vs 3–6s); reconcile on gpt-4.1-mini (~1.4s). detail:"high" on crops, max_tokens
1000 (500 truncated strict-JSON on 12-item scenes). Both verified against the live API
with our exact strict-schema request before deploying.

## Accumulation bugs found by the richer model (fixed in RentgenClient)
1. Adapter ids restart per call (oa-0, oa-1…) → collisions across accumulated scans →
   broken React keys (14 chips for 8 items) + selection toggling the wrong items. Fix:
   `withUniqueIds` remaps incoming ids against the inventory before merging.
2. Dedup keyed on name+category left duplicates when the category wobbled between scans
   ("Other" vs "Home & Kitchen" for the same ruler). Dedup now keys on the exact name
   alone (case-insensitive) — the specificity ladder makes identical names safe to merge;
   fuzzy/substring merging rejected ("iPhone 13" ⊂ "iPhone 13 Pro" would wrongly merge).

## Live dock feedback: ghost chips on scan:start
The dock shows a pulsing "Scanning…" ghost chip the moment a crop is captured
(scan:start), replaced by the named chip on scan:complete; newest finds render first.
No contract change — pending = starts − completes − errors, counted in the app.

## Grounding hazards found live (enrichment)
Two real failure modes surfaced in live testing, both now handled in `tavily-comps.ts`:
1. **Name collision:** "Sony a7 III" matched *Audi A7* eBay listings. Fix: category added
   to the resale query as a disambiguator + `search_depth: 'advanced'`.
2. **Wrong product class in rentals:** a €4 paper notebook matched *laptop rental* sites →
   rent €30/day > resale. Fix: rent-vs-resale sanity clamp — if reconciled rent/day
   exceeds ~8–10% of the resale midpoint, discard the rental comps and fall back to the
   derived 1.5–3%/day band. (The model returning `{0,0}` when comps are useless is treated
   as a hard throw, never clamped to a fake €1.)

## Verified live in-browser (real keys, 2026-07-18, twice)
Full chain in an actual browser page: OpenAI vision → Tavily comps + reconcile → grounded
prices with real source URLs (e.g. mac-store24 used-MacBook listings) → idle-capital total.
Tavily CORS confirmed in-browser, not just in the Node preflight. Post-rent-clamp re-run:
3 items, €949 total, all rents plausible, one unpriceable item (pencil) dropped by
per-item failure isolation without killing the scan. Rehearsal re-scan of the same real
image: 8 ms cache hit. Single-item enrich 3.4–9.8 s. Expect run-to-run variance in the
absolute numbers — Tavily results differ per run; ranges + sources absorb it.

## Verified live in-browser (stub path, 2026-07-18 ~16:00)
Scan → 4 cards + animated €-total → rehearsal re-scan 0 ms cache hit (same sessionId) →
uncheck in `<rentgen-results>` updates `<rentgen-upsell>` ("3 selected · 210 €/wk") via the
`selection:change` bus event. OpenAI vision adapter separately live-verified against the
real API (4 correct objects from a desk photo).

## wmux browser can't do camera/file-picker
Headless-panel smoke tests drive the scanner via
`document.querySelector('rentgen-scanner').runScan(dataUrl)` (TS-private, runtime-public)
and fetch test images from `apps/app/public/` — data URLs are too big for eval args.

## Client accumulates the inventory across scans (v2 flow)
`RentgenClient` keeps a running deduped inventory; every `scan()` merges into it and
emits the FULL accumulated `ScanResult` under one session id — so the live-pan total
climbs, review shows everything, and the export bundle covers the whole walkthrough.
`resetSession()` starts fresh. Trade-off: a session's persisted `imageHash` is the
latest image only, so re-scanning an *earlier* photo after other scans re-runs the
APIs (dedup still prevents duplicates).

## Review widgets must stay mounted
`<rentgen-results>`/`<rentgen-upsell>` render from live bus events and miss anything
emitted before they connect. The app keeps the review tree always mounted
(`display:none` outside the review phase) instead of mounting it on phase switch.

## wmux browser panel throttles requestAnimationFrame
Count-up animations look "stuck" when sampled via eval right after events — they
complete once frames are produced. Test-environment quirk only; real browsers are fine.

## sideEffects tree-shaking SHIPPED as a real bug — "camera not working"
The production build dropped `<rentgen-scanner>` entirely: the root barrel re-exported it
through `capture/index.ts`, which wasn't on the sideEffects allowlist, so Rollup treated
the barrel as pure, saw the class binding unused, and pruned the whole chain —
`customElements.define` never ran, the element sat inert, and getUserMedia was never
called ("not even asking for permissions"). Dev mode doesn't tree-shake, so localhost lied.
Fixes (both): the root barrel now side-effect-imports every `rentgen-*.ts` widget file
directly, AND the allowlist includes `./src/**/index.ts`. Detection signal: the
`vision_bundle` (MediaPipe) chunk appears in the build output only when the scanner made
it in. Lesson: smoke-test the PRODUCTION bundle (`vite preview`), not just dev.

## MediaPipe GPU delegate can be silently blank — zero detections, no error
The GPU delegate can initialize without throwing yet return zero detections forever
(blank texture reads; seen in the embedded-panel browser, possible on real devices with
broken WebGL). The scanner watches for it: ≥40 consecutive empty inferences (~5 s) with a
GPU delegate → `reloadDetectorCpu()` rebuilds on CPU once (console.warn logged). CPU
EfficientDet-Lite0 int8 is fast enough for the demo. Verified end-to-end with a fake
`canvas.captureStream()` camera: fallback fires → tracker confirms → one scan per object
→ AR chips with per-object prices → real crops on every review item.

## Camera error UX (ported from krempel main.ts)
Upfront `navigator.mediaDevices?.getUserMedia` existence check (in-app browsers ship
without it) with an explicit "open in Safari/Chrome" message; real error NAMES surfaced
(NotAllowedError → settings hint, NotFoundError → no device); `console.error` of the raw
error; gesture-bound "Enable camera" retry button; photo upload always available.
