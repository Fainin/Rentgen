# Workstream 2 — Object classification "What is this?"

**Owner:** _(you)_ · **Package:** `@rentgen/sdk` · **Your folder:** `packages/sdk/src/detection/`

> **Read first:** [`/CLAUDE.md`](../../../CLAUDE.md) · the
> [design spec](../2026-07-18-rentgen-sdk-design.md) (§4 adapters) · the
> [workstreams README](README.md) (ownership + frozen seam registry).

## Your mission

Given an image, answer **"what is this?"** — return the distinct sellable/rentable objects
in it, each with a name, category, condition, and confidence. You use OpenAI vision.

> ⚠️ **Naming heads-up:** the SDK interface you implement is called **`DetectionAdapter`**,
> but on the whiteboard this is the **classification** step. "Detection from video" is
> Stream 1. You classify *what's in an image*; you don't touch the camera.

## Where you fit

```
   (1) image/crop  ──►  YOU: DetectionAdapter.detect(img) → DetectedObject[]  ──►  (3) price each object
```

## You own (create these)

- `detection/openai-vision.ts` — implements `DetectionAdapter`: browser `fetch` → OpenAI
  vision → parse JSON → `DetectedObject[]`. Prompt: "list distinct sellable/rentable
  objects, each with name, category, condition (e.g. 'used - good'), confidence 0..1."
- `detection/stub.ts` — a `DetectionAdapter` returning deterministic mock objects (no key,
  no network) so downstream can run offline.
- `detection/index.ts` — barrel exporting **`createDetectionAdapter(config)`** which returns
  the real adapter when `config.openaiApiKey` is set, else the stub.

## Your seam (what the rest of the app relies on)

```ts
// detection/index.ts
export function createDetectionAdapter(config: { openaiApiKey?: string }): DetectionAdapter
```

Return type is the frozen `DetectionAdapter`. Stream 4 wires this into `configureRentgen`
by importing your factory — it never edits your files, you never edit its.

## Pre-made decisions (so we don't collide)

- Output **must** match `DetectedObject` exactly: `{ id, name, category, condition,
  confidence }`. Give each a **prefixed id** (`oa-0`, `oa-1`, …) so ids never collide with
  other detection sources.
- Validate the model's JSON defensively (it will occasionally return junk); clamp
  `confidence` to 0..1; never throw on a missing field — fall back to sane defaults, and
  only throw on a hard API failure (Stream 4 surfaces it as `scan:error`).
- Keys arrive via the **factory config** (from `configureRentgen`). **Never** read
  `import.meta.env` here — the SDK stays framework-agnostic.
- Everything lives in `detection/`; the only outside imports are frozen types/interfaces.

## Do NOT touch (frozen / other owners)

`types.ts`, `adapters/types.ts`, `events.ts`, `config.ts`, `index.ts`, `enrichment/**`.

## 🚧 Stop & coordinate if…

- you want to **add a field** to `DetectedObject` (brand, model, bounding box, multiple
  categories) → it's a frozen type used by **Streams 3 & 4** → agree first, then Stream 4
  edits `types.ts`.
- pricing needs a differently-shaped hint than `DetectedObject` carries → **Stream 3**.
- you feel tempted to also fetch prices or render → that's **Stream 3 / Stream 4**; stop.
- Claude: if the task needs a shared-type change, **name Streams 3 & 4 and ask me to
  coordinate** before editing anything outside `detection/`.

## Definition of done

- `createDetectionAdapter({ openaiApiKey })` turns a real photo into a sensible
  `DetectedObject[]` on the demo objects.
- The stub variant returns believable objects with no key, so the full chain runs offline.
