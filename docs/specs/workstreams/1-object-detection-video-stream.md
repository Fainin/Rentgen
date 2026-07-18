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
Phase-2 (only once the end-to-end demo is green): live pan with an in-browser detector.

## You own (create these)

- `capture/rentgen-scanner.ts` — the `<rentgen-scanner>` Lit element: camera preview +
  capture button (Phase 1), `<canvas>` overlay + live boxes (Phase 2).
- `capture/detector.ts` — in-browser detector (TF.js COCO-SSD or transformers.js YOLO),
  a few fps, returns boxes. Lazy-load the model so it never blocks first paint.
- `capture/tracker.ts` — centroid/IoU tracker → a stable `trackId` per physical object.
- `capture/crop.ts` — **best-in-frame** selection: buffer a new track ~1s, pick the frame
  where it's largest + most centered + sharpest, crop it to a data URL.
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

### Detector: boxes are your product, labels are garnish

The pipeline only needs **class-agnostic boxes** — Stream 2 does the real "what is this?" on
the crop. True objectness-only models exist (SAM's automatic mask mode, CutLER, bare RPNs)
but none of them run in a browser at live fps. The pragmatic equivalent: run a fast COCO
detector and **treat its labels as disposable** — use every box above a *low* threshold
(~0.25) regardless of class. A camera boxed as "cell phone" is a win: the box is right, and
GPT-4o will name it correctly from the crop.

- **Primary: MediaPipe Object Detector (EfficientDet-Lite0)** — ~4.5 MB, very fast, clean
  web API (`@mediapipe/tasks-vision`), Apache-2.0. Lazy-load on first camera start.
- **Fallback: TF.js COCO-SSD** if MediaPipe fights the bundler — 3-line API, slower.
- **Not now:** YOLOv8 (AGPL — we ship an SDK), OWLv2 (~1 fps, not live), YOLO-World with a
  custom vocabulary (the *right* long-term detector — post-hackathon backlog).
- **Demo insurance:** COCO has no camera/guitar/drill class. Low threshold catches most of
  them as *some* box anyway, but pick hero demo items that box reliably (laptop, headphones,
  books, clock, backpack, bottle, keyboard) and rehearse with the real venue objects.

### Tracker (`tracker.ts`): stable ids from noisy boxes

Greedy IoU matching per detector tick (IoU ≥ 0.3 = same track), exponential moving average
(α≈0.4) to smooth box jitter. Track lifecycle: `tentative` → `confirmed` after **N=5**
consecutive hits (~1 s at 5 fps) → `lost` after **M=10** consecutive misses. Only a track
reaching `confirmed` for the first time may trigger a scan.

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

Buffer candidate frames for a newly confirmed track for ~1 s (up to 8 candidates), score
each, keep the winner:

```
score = √areaFrac · centeredness · sharpness · detectorConfidence
  areaFrac     = boxArea / frameArea                       (bigger is better, √ damps it)
  centeredness = 1 − distance(boxCenter, frameCenter)/maxDist
  sharpness    = variance of Laplacian on a 64 px grayscale thumbnail of the box
                 (normalized against the running max this session)
```

Winning crop: box + 10 % margin, clamped to frame, longest side downscaled to **768 px**,
JPEG quality **0.85**, as a data URL. That data URL is *the* item image downstream — what
you pass to `scan()` is what Stream 4 can persist and render on the card. Make it good.

**One-image invariant:** each physical object ends the pipeline with **exactly one** image —
the one you pass to `scan()`. Candidate buffers are discarded once the winner is picked;
nothing downstream ever sees multiple frames per item.

### Optional model cutout (`cutout.ts`) — background removal on the winning crop

The rectangle crop (background included) is the baseline and always works. If time allows,
refine the winner with an in-browser segmentation pass **before** firing `scan()`, so the
one-image invariant holds — the cutout simply *becomes* the item's one image:

- **SlimSAM** (`Xenova/slimsam-77-uniform` via `@huggingface/transformers`, ~30–40 MB
  quantized, WebGPU with WASM fallback), prompted with the detector box → mask → item on
  white background → same 768 px JPEG data URL as the plain crop.
- The 1–2 s it costs runs while the AR overlay shows "scanning…" — no perceived stall.
- **Quality gate:** if the best mask covers < 20 % or > 95 % of the box, or the model isn't
  loaded yet, silently fall back to the rectangle crop. The cutout may never block or fail
  a scan.
- Lazy-load the model when the camera starts (parallel to the detector); until it's ready,
  rectangle crops ship. The demo works either way.

### "AR" overlay — yes, the cheap kind

Live boxes-in-camera is very doable and demos great; real WebXR/world-anchoring is not a
hackathon feature (objects only need highlighting *while on screen* — no SLAM, skip it).

- One `<canvas>` absolutely positioned over the `<video>`, sized with `devicePixelRatio`,
  redrawn per detector tick with the EMA-smoothed boxes (smoothing hides the low fps).
- Box states: **tentative** (thin outline) → **scanning** (accent color, pulsing, after you
  fired `scan()`) → **priced** (solid + chip like `✓ €60–90`).
- You know the price without any new event or contract change: you called
  `getClient().scan(crop)` yourself — `await` the returned `ScanResult`, take the item's
  resale range, draw the chip on that track's box. Track gone ⇒ chip gone; fine for a demo.

### Build order (each step demos on its own)

1. **Tap-to-capture** `<rentgen-scanner>` → full-photo `scan()` against the stub client. ← Phase-1 DoD
2. Detector wired, raw boxes drawn on the overlay (no tracker yet) — the "it's alive" moment.
3. Tracker + confirmed-gate + best-crop buffer → one `scan()` per object.
4. dHash re-entry guard.
5. Box states + price chips (the AR polish).
6. SlimSAM cutout behind the quality gate.

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
