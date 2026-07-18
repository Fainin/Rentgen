# Workstream 3 — Product live research and population

**Owner:** _(you)_ · **Package:** `@rentgen/sdk` · **Your folder:** `packages/sdk/src/enrichment/`

> **Read first:** [`/CLAUDE.md`](../../../CLAUDE.md) · the
> [design spec](../2026-07-18-rentgen-sdk-design.md) (§4–§5, §7 partner tools, §9 CORS
> risk) · the [workstreams README](README.md) (ownership + frozen seam registry).

## Your mission

Given one classified object, **research live web comps and populate a defensible price** —
resale range, rent/day range, and the **source links** that back them. Numbers must be
*grounded, not hallucinated*. You use Tavily (search) → OpenAI (reconcile).

## Where you fit

```
   (2) DetectedObject  ──►  YOU: EnrichmentAdapter.enrich(obj) → EnrichedItem  ──►  (4) total + render, (5) upsell
```

## You own (create these)

- `enrichment/tavily-comps.ts` — implements `EnrichmentAdapter`: Tavily search for resale +
  rental comps (keep the source URLs) → OpenAI reconciles the noisy results into
  `{ resale, rentPerDay }` ranges.
- `enrichment/stub.ts` — an `EnrichmentAdapter` returning deterministic mock prices +
  fake-but-plausible sources (no keys, no network).
- `enrichment/index.ts` — barrel exporting **`createEnrichmentAdapter(config)`** (real when
  both keys are present, else stub).

## Your seam (what the rest of the app relies on)

```ts
// enrichment/index.ts
export function createEnrichmentAdapter(config: {
  tavilyApiKey?: string; openaiApiKey?: string; currency?: string;
}): EnrichmentAdapter
```

Return type is the frozen `EnrichmentAdapter`. Stream 4 imports and wires it.

## Pre-made decisions (so we don't collide)

- Output **must** match `EnrichedItem`: `DetectedObject` + `{ resale: PriceRange,
  rentPerDay: PriceRange, sources: Source[] }`. **Always** attach ≥1 source (that's the
  whole grounding story). Preserve the incoming `id`.
- **Currency default `'EUR'`** across the demo (the total assumes one currency). Don't mix.
- **Tavily CORS is the hour-1 risk (design §9).** If direct browser calls are blocked,
  change **only the transport inside `tavily-comps.ts`** (e.g. a CORS-safe hosted path) —
  the `EnrichmentAdapter` interface hides *where* the call runs, so nothing else moves.
  Smoke-test this first thing; don't discover it on demo day.
- Keys via the **factory config**, never `import.meta.env`. Reconcile step: ask OpenAI for
  strict JSON and parse defensively; throw only on hard API failure.
- Everything in `enrichment/`; outside imports = frozen types/interfaces only.

## Do NOT touch (frozen / other owners)

`types.ts`, `adapters/types.ts`, `events.ts`, `config.ts`, `index.ts`, `detection/**`.

## 🚧 Stop & coordinate if…

- you want a **new field** on `EnrichedItem`/`PriceRange`/`Source` (e.g. price confidence,
  availability, per-item currency) → frozen types used by **Streams 4 & 5** → agree first.
- the **total math** should change (not "Σ resale midpoints") → **Stream 4** owns the total.
- upsell needs a pricing signal you don't emit (monthly projection basis, CO₂ factor) →
  **Stream 5**.
- Claude: if a task needs a shared-type or total-logic change, **name Streams 4 & 5 and ask
  me to coordinate** before editing outside `enrichment/`.

## Definition of done

- `createEnrichmentAdapter({ tavilyApiKey, openaiApiKey })` prices a real `DetectedObject`
  with grounded ranges + real source links.
- The stub prices anything instantly offline, so the end-to-end chain always demos.
