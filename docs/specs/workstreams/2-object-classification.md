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
export function createDetectionAdapter(config: { openaiApiKey?: string; model?: string }): DetectionAdapter
// model default: 'gpt-4.1' (upgraded from gpt-4o mid-hackathon — better crop reading, faster)
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

## Design decisions (build against these)

### Model & transport

- **`gpt-4o`** with **Structured Outputs** (`response_format: { type: "json_schema", strict: true }`)
  — the JSON always parses, no regex rescue. Use `gpt-4o-mini` only as a speed/cost fallback,
  selectable via the factory config's optional `model` field (default `gpt-4o`); brand/model
  reading off small crops is where mini gets worse.
- Plain browser `fetch` to `https://api.openai.com/v1/chat/completions`, key from the
  factory config. Image goes in as the data URL you received — no re-encoding (Stream 1
  already delivers ≤768 px JPEG; a Phase-1 full photo may be bigger — pass
  `detail: "auto"` and don't worry).
- One retry on 429/5xx with short backoff, then throw (Stream 4 turns it into `scan:error`).

### The prompt is the product — what "best data" means downstream

Stream 3 builds **search queries** from your `name` + `category`, and Stream 4 prints them
on cards. Optimize for that, in this order:

1. **Name specificity ladder** (instruct the model explicitly):
   brand + model if legible (`"Canon PowerShot G7X Mark II"`) → brand + type
   (`"Bosch cordless drill"`) → precise generic (`"18V cordless drill"`). Never vague
   (`"electronic device"` is a failed classification — drop it below the confidence gate).
2. **Category from a fixed list** (keeps Stream 3's queries and Stream 4's grouping stable):
   `Photography · Electronics · Audio · Gaming · Computing · Tools · Sports & Outdoor ·
   Music Instruments · Home & Kitchen · Furniture · Other`. The type stays `string` (no
   contract change) — the list lives in your prompt and a `const` you export for reuse.
3. **Condition** as short resale-speak from visible evidence only: `"used - good"`,
   `"used - visible wear"`, `"like new"`. No invented condition details.
4. **Confidence** = identification certainty (is the *name* right?), not "is there an
   object". Tell the model: unreadable brand ⇒ generic name + honest lower confidence.
5. **Skip rules:** no fixtures, no walls/floor, no cables/chargers as standalone items, no
   people. Sellable/rentable movable goods only.

### One adapter, two callers

Phase 1 sends a full room photo (expect 3–10 objects), Phase 2 sends a single-object crop
(expect exactly 1, occasionally 0 or 2). Same prompt handles both: "list each distinct
object" — do **not** special-case crops. An empty array is a valid, correct answer.

### Validation (the model will eventually return junk)

- Parse defensively even with strict mode: missing `name` ⇒ drop the entry; missing
  `category` ⇒ `"Other"`; missing `condition` ⇒ `"used - good"`; clamp `confidence` to 0..1.
- Drop entries with `confidence < 0.3` — better a missed item than a garbage card in the
  demo.
- Ids: `oa-<n>` with a per-call counter — a **Stream-2 convention** (prefixed so ids never
  collide with other detection sources); not a registry-defined rule.
- Cap at 12 objects per image (prompt *and* code) — a Phase-1 room shot must not explode
  Stream 3 with 30 parallel Tavily runs.

### Duplicates — your part vs. not your part

Stream 1 prevents most double-scans (tracker gate + image hash). What still gets through:
the same physical object scanned from two angles, or appearing in a Phase-1 photo *and* a
Phase-2 crop. Your contribution is **consistent naming** (the specificity ladder — two crops
of the same G7X should classify to the *same string*), which is exactly what makes
**Stream 4's** name+category merge at compile time work. The merge itself is theirs — flag
it, don't build it.

### Cost/latency budget (credits are fine, seconds are not)

~1 crop ≈ 1 call ≈ 2–4 s. That's fine: calls run per-object in parallel and the AR overlay
(Stream 1) shows "scanning…" meanwhile. Keep `max_tokens` ≤ 500 and the temperature at 0.2
— we want the same answer for the same object every time (that consistency is also what
makes dedup and the rehearsal cache work).

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
