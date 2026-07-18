# Workstream 4 — Compile Results with "wow effect"

**Owner:** _(you)_ · **Package:** `@rentgen/sdk` + `apps/app` · **You are the integration hub.**

> **Read first:** [`/CLAUDE.md`](../../../CLAUDE.md) · the
> [design spec](../2026-07-18-rentgen-sdk-design.md) (§3 architecture, §5 data flow, §2 the
> demo) · the [workstreams README](README.md) (ownership + frozen seam registry — **you
> publish and steward it**).

## Your mission

**Assemble the pipeline and make the payoff land.** Wire detect→enrich→total→persist, then
render it with impact: item cards + the climbing **idle-capital total** →
*"€4,200 idle. Earning €0."* You own the glue *and* the money shot.

## Where you fit

```
   (1) scan(img) ──► YOU: RentgenClient (calls 2 → 3 in parallel) ──► ScanResult ──► <rentgen-results> WOW
                                                                              └──► (5) upsell renders from the same result
```

## You own (create these)

- `client/RentgenClient.ts` — `scan(imageBase64)`: image-hash cache → `DetectionAdapter` →
  `EnrichmentAdapter` per object (**parallel**) → compute total → persist → **emit
  `scan:complete`** → return `ScanResult`. Also `consume(sessionId)`.
- `config.ts` — `configureRentgen(config)` / `getClient()`. **Imports the other streams'
  factories** (`createDetectionAdapter`, `createEnrichmentAdapter`, `createAssetAdapter`)
  and picks real-vs-stub by which keys are present.
- `storage/sessionStore.ts` — localStorage wrapper + image-hash cache (instant rehearsal).
- `events.ts` — the event names/payloads (`scan:start|complete|error`). **Publish this in
  hour 1** so everyone else is unblocked.
- `results/rentgen-results.ts` — the `<rentgen-results>` element: cards (resale, rent/day,
  sources, confidence chip) + the animated total. `results/total.ts`, `results/format.ts`.
- `index.ts` — the root barrel (re-exports each stream's public surface).
- `apps/app/src/App.tsx` — calls `configureRentgen({ VITE_* keys })`, lays out the headline
  + mounts `<rentgen-scanner>` / `<rentgen-results>` (+ a slot for `<rentgen-upsell>`).

## Your hour-1 deliverable (unblocks everyone)

Publish the seam **with stubs**: `events.ts`, `getClient()`/`configureRentgen` returning a
stub-backed client, and the frozen factory names in the README. After that, Streams 1/2/3/5
build against it in parallel and you swap their real modules in as they land — no rewiring.

## Pre-made decisions (so we don't collide)

- `totalIdleValue` = **Σ of each item's resale midpoint** `(min+max)/2`. Single currency
  (`EUR`). This is the frozen total contract.
- `RentgenClient` **awaits enrichments with `Promise.all`** (parallel, one call per object).
- The **event bus is the only widget↔widget channel.** Results subscribes to
  `scan:complete`; it never imports the scanner or the client internals.
- Provide a **named slot / mount point** in `<rentgen-results>` for Stream 5's upsell, and
  agree its exact contract with Stream 5 (don't hard-code upsell logic in results).
- Keys stay in `apps/app` env and are passed into `configureRentgen`; the SDK never reads
  `import.meta.env`.

## Agreed handoffs from Streams 1 & 2 (team-confirmed)

Two compile-time duties land here (details in specs 1 & 2, "Design decisions"):

1. **Semantic dedup on compile.** Stream 1's tracker gate + image hash stop most double
   scans, but the same physical object scanned from two angles (or via a Phase-1 photo *and*
   a Phase-2 crop) still slips through. In `RentgenClient`, merge items whose
   `name`+`category` match (case-insensitive) before totaling — keep the higher-confidence
   one. Stream 2's naming rules are designed to make this string-stable.
2. **Persist the scan image as the item image.** `EnrichedItem` has no image field, but the
   cards need a photo: the `imageBase64` passed into `scan()` *is* the item image — exactly
   **one image per item**, ever (Phase 2: a single-object crop; a white-background cutout
   instead if Stream 1's optional SlimSAM step is active — same field, same shape, you can't
   tell and don't need to). Store it on the session
   keyed to the scan's items so `<rentgen-results>` and Stream 5 can render it. If that
   means a field on `Session`/`ScanResult`, that's your frozen-file stewardship call —
   update the README registry when you do it.

## Steward, don't hoard (the frozen files)

You *own* `types.ts`, `adapters/types.ts`, `events.ts`, `config.ts`, `index.ts` — but they
are **shared contracts**. When another stream needs a change here, treat it as a team
decision, make the edit deliberately, and keep the README registry in sync.

## 🚧 Stop & coordinate if…

- a card needs a **field the adapters don't emit** → **Stream 2 (classify)** or **Stream 3
  (price)** must add it to their output first (and to the frozen type, together).
- the **upsell placement/contract** shifts → **Stream 5**.
- capture needs a **new event** → you own `events.ts`, but confirm the payload with
  **Stream 1** before freezing it.
- Claude: when a request crosses into another stream's data, **flag which stream owns it and
  ask me to coordinate** rather than guessing their output shape.

## Definition of done

- One `scan()` → cards + a correct, animated idle-capital total, end-to-end (stub → real).
- `npm run dev` boots the assembled app; a rehearsal re-scan is instant (cache hit).
