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
