# Workstream 1 — Object detection from video stream

**Owner:** _(you)_ · **Package:** `@rentgen/sdk` · **Your folder:** `packages/sdk/src/capture/`

> **Read first:** [`/CLAUDE.md`](../../../CLAUDE.md) · the
> [design spec](../2026-07-18-rentgen-sdk-design.md) (esp. §6 Phase 2) · the
> [workstreams README](README.md) (ownership + frozen seam registry).

## Your mission

Turn the live camera into **one clean cropped image per physical object**, and fire a scan
for each. You are the "eyes" — you find *that there is a thing* and hand a good picture of it
to the pipeline. You do **not** name it or price it.

## Where you fit

```
   camera ──►  YOU: detect + track + best-crop  ──►  getClient().scan(crop)  ──►  (2) classify → (3) price → (4) render
```

Phase-1 fallback (build this first): a **tap-to-capture** button that sends one full photo.
Phase-2 (only once the end-to-end demo is green): live pan — frames sampled every ~250 ms go to
cloud detection (`gemini-flash-latest`), identified objects stream into the results list as clean
cards. **No on-device model, no bounding-box overlay** (see Detector below).

## You own (create these)

- `capture/rentgen-scanner.ts` — the `<rentgen-scanner>` Lit element: camera preview +
  capture button (Phase 1), periodic frame sampler (Phase 2). **No `<canvas>` overlay, no live
  boxes** — results render as cards in Stream 4's list, not as jittery boxes on the feed.
- `capture/detector.ts` — a thin frame sampler: every ~250 ms during a pan, grab one JPEG
  frame and `POST` it to `gemini-flash-latest` (browser `fetch`, `x-goog-api-key` header,
  `response_schema`-validated JSON) → identified objects (name/category/confidence + optional
  region), **not** boxes. Lazy on first capture; no model bundle ships to the browser.
- `capture/tracker.ts` — identity dedup, not box-IoU: match Gemini's `name`+`category` against
  already-scanned items, fall back to a 64-bit **dHash** of the frame (Hamming ≤ 10) when naming
  is ambiguous. Goal unchanged: one scan per object.
- `capture/crop.ts` — **best-frame** selection: buffer ~0.5 s of frames for a new identity,
  keep the largest + sharpest, crop to a 768 px JPEG data URL — *the* item image downstream.
- `capture/index.ts` — barrel (exports the element registration).

## Your seam (what the rest of the app relies on)

- The element `<rentgen-scanner>` (self-registers on import).
- For each captured object you call **`getClient().scan(imageBase64)`** and emit
  `scan:start` first (so results can show a spinner). That's it — the client (Stream 4)
  runs classify→price→compile and emits `scan:complete`.
- **Gate rule (Phase 2):** only a *new* track stable for ≥ N frames triggers a scan; known
  tracks are ignored → no double-counting, no cost blow-up.

## Pre-made decisions (so we don't collide)

- `imageBase64` is a **data URL** (`data:image/jpeg;base64,…`); Phase 1 sends a full photo,
  Phase 2 sends a single-object crop — **same `scan()` call** either way.
- Detector/tracker/model files live **only** in `capture/`. No other stream imports them.
- Theme via CSS custom properties only (`--rentgen-accent`, `--rentgen-radius`, …).
- You depend on Stream 4's hour-1 seam (`getClient()`, `events.ts`); until it lands,
  `getClient()` returns a stub client, so you can build and see fake results offline.

## Design decisions (build against these)

### Detector: cloud vision, no boxes on the feed

The live pan sends frames to **`gemini-flash-latest`** (Google AI Studio, `GEMINI_API_KEY`,
free tier) — the same alias krempel uses; we call it from the browser. Gemini returns
**identified objects** (name + category + confidence, optionally a normalized region), not
boxes. There is **no bounding-box overlay on the camera feed** — the planned Phase-2 "AR"
gimmick glitches at low fps and reads as fake; results surface as clean cards in Stream 4's
list instead.

- **Transport:** plain browser `fetch` to
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`,
  `x-goog-api-key` header, `response_schema` enforcing the JSON-array shape. Parse defensively
  (drop `confidence < 0.4`, cap at 20 items, clamp/strip strings) — Gemini output is untrusted.
- **Cadence:** one frame every ~250 ms (4 fps) during a pan — catches every object, stays in
  the free tier. `AbortSignal.timeout` per call so a hung request never stalls the pan.
- **One job per model:** Gemini is the **live lane** (fast, free). **gpt-5.6-luna** (Stream 2)
  is still the **hero still lane** for a Phase-1 full photo. Both return the `DetectedObject`
  shape; the factory in Stream 2 stays OpenAI-only.
- **No model bundle ships to the browser.** MediaPipe / TF.js / SlimSAM are all dropped — no
  4.5 MB EfficientDet, no WASM, no WebGPU. The SDK stays light; that is the point of going cloud.
- **Demo insurance:** Gemini recognizes a camera/drill/guitar where COCO had no class. Still
  rehearse with hero items that frame cleanly (laptop, headphones, camera, drill).

### Tracker (`tracker.ts`): one scan per object, no boxes to smooth

Without boxes there is no IoU matching. Dedup is **identity-first**: normalize Gemini's
`name`+`category` (Stream 2's specificity ladder) and compare against already-scanned items —
a match ⇒ skip silently. Lifecycle collapses to: `seen once` → `confirmed` after the **same
identity** appears in **N=2** consecutive frames (~0.5 s at 4 fps) → triggers exactly one
`scan()` with the best frame. The dHash re-entry guard (below) is the fallback when two frames
of the same object get named differently.

### Never scan the same thing twice — three layers

1. **Tracker gate (yours):** only *newly confirmed* tracks trigger `scan()`; a `trackId`
   scans at most once, ever.
2. **Re-entry guard (yours):** the tracker can't recognize an object that left the frame and
   came back (new trackId). Before scanning, compute a 64-bit **dHash** of the candidate
   crop and compare (Hamming distance ≤ 10) against all crops already scanned this session —
   match ⇒ skip silently. ~30 lines, no model, lives in `crop.ts`.
3. **Semantic merge (NOT yours):** two different-looking crops of the same physical object
   (front/back) slip through 1+2. The fix — merging items whose `name`+`category` match —
   belongs to **Stream 4** at compile time. Flag it to them; do not build it here.

### Best-image selection (`crop.ts`)

Ask Gemini to return a **normalized region** per object (`{x,y,w,h}` in 0..1 of the frame).
Buffer candidate frames for a newly confirmed identity for ~0.5 s (up to 4 candidates), score
each, keep the winner:

```
score = √areaFrac · centeredness · sharpness
  areaFrac     = regionArea / frameArea                  (bigger is better, √ damps it)
  centeredness = 1 − distance(regionCenter, frameCenter)/maxDist
  sharpness    = variance of Laplacian on a 64 px grayscale thumbnail of the region
                 (normalized against the running max this session)
```

Winning crop: region + 10 % margin, clamped to frame, longest side downscaled to **768 px**,
JPEG quality **0.85**, as a data URL. **Fallback:** if Gemini returns no region, ship the full
frame downscaled to 768 px — never block a scan on a missing box. That data URL is *the* item
image downstream — what you pass to `scan()` is what Stream 4 persists and renders. Make it good.

**One-image invariant:** each physical object ends the pipeline with **exactly one** image —
the one you pass to `scan()`. Candidate buffers are discarded once the winner is picked;
nothing downstream ever sees multiple frames per item.

### Optional background removal — via Gemini, not a bundled model

If a clean cutout (item on white) is wanted for the card, ask **the same `gemini-flash-latest`
call** for a mask and apply it client-side to the winning crop → item on white → same 768 px
JPEG data URL. **No bundled segmentation model** — the old SlimSAM / `@huggingface/transformers`
30–40 MB download is dropped (it was a local model; we ship none). Quality gate unchanged: mask
< 20 % or > 95 % of the region ⇒ silently fall back to the rectangle crop. Optional polish; the
demo works with plain crops.

### No overlay — results live in the card list

There is **no `<canvas>` overlay and no live boxes on the camera feed** (dropped: it glitches at
low fps and reads as "fake AR"). The camera preview stays clean; detected+priced items appear as
cards in Stream 4's results list, streaming in as each scan completes. You still know each price
— you `await`ed the `ScanResult` yourself — you just surface it via `scan:complete` into the
list, not onto the feed.

### Build order (each step demos on its own)

1. **Tap-to-capture** `<rentgen-scanner>` → full-photo `scan()` against the stub client. ← Phase-1 DoD
2. Frame sampler wired → one Gemini call per frame during a pan, results stream into the list.
3. Identity tracker + confirmed-gate + best-frame buffer → one `scan()` per object.
4. dHash re-entry guard.
5. Gemini-returned region → framed crops on the cards (polish).
6. Optional Gemini mask → white-background cutout (luxury).

Cut from the bottom if the clock wins: 1–3 are the demo, 4–5 are delight, 6 is luxury.

## Do NOT touch (frozen / other owners)

`types.ts`, `events.ts`, `adapters/types.ts`, `config.ts`, `client/**`, `index.ts`
(Stream 4). You never classify (Stream 2), price (Stream 3), or render cards (Stream 4).

## 🚧 Stop & coordinate if…

- you need a **new event** or to change `scan:*` payloads → **Stream 4** (owns `events.ts`).
- you want to pass boxes/coordinates/`trackId` **downstream** (e.g. draw a box around a
  priced item) → that changes `DetectedObject`/`ScanResult` shape → **Streams 2 & 4**.
- the crop needs metadata the classifier should see → **Stream 2**.
- Claude: if a task pushes past capture into naming/pricing/rendering, **say so and tell me
  which teammate owns it** before writing across the line.

## Definition of done

- **Phase 1:** tap → a full photo → results appear (via the stub or real pipeline).
- **Phase 2:** slow pan across a table → each object triggers exactly one scan; the total
  climbs; no duplicates. Runs at a usable fps on a phone.
