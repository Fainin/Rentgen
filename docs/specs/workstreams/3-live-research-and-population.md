# Workstream 3 — Product live research and population

**Owner:** _(you)_ · **Package:** `@rentgen/sdk` · **Your folder:** `packages/sdk/src/enrichment/`

> **Read first:** [`/CLAUDE.md`](../../../CLAUDE.md) · the
> [design spec](../2026-07-18-rentgen-sdk-design.md) (§4–§5, §7 partner tools, §9 CORS
> risk) · the [workstreams README](README.md) (ownership + frozen seam registry).

## Your mission

Given one classified object, **research live web comps and populate a defensible price** —
resale range, rent/day range, and the **source links** that back them. Numbers must be
*grounded, not hallucinated*. You use Tavily (search) → OpenAI (reconcile).

**Success metric:** `createEnrichmentAdapter({ tavilyApiKey, openaiApiKey })` prices a real
venue object with plausible EUR ranges and ≥1 clickable, real source link, in < ~8s. The
stub prices anything instantly offline.

**Grounding is the product.** The temptation is to let OpenAI price from priors and
decorate with links. The pipeline must be the reverse: Tavily results in → OpenAI reconciles
*only those* → sources are the actual result URLs. The prompt must forbid outside knowledge
for the numbers.

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
- **Comp noise:** search results mix new-price, broken-item, and wrong-model listings. Ask
  OpenAI for a *range* (min/max of plausible used comps), not a point — ranges absorb noise.
- **Query construction matters more than the model.** `"{name} {condition}" used price site:ebay OR marketplace`
  style queries beat generic ones. Keep query builders as small pure functions (testable by eye).
- **Single reconcile call.** Two Tavily searches per object (resale, rental) run in
  **parallel**; one OpenAI JSON-mode call reconciles *both* ranges — cheaper and atomic.

## Requirements

- **R1:** `index.ts` exports `createEnrichmentAdapter(config: { tavilyApiKey?: string;
  openaiApiKey?: string; currency?: string }): EnrichmentAdapter` — real adapter iff **both**
  keys present, else the stub.
- **R2:** Stub is deterministic (same input → same output), zero network, resolves fast
  (<50ms), returns a valid `EnrichedItem` with ≥1 plausible fake source; prices vary by
  category so the demo total looks real.
- **R3:** Both adapters return an `EnrichedItem` that preserves *every* incoming
  `DetectedObject` field unchanged (esp. `id`) and adds `resale`, `rentPerDay`, `sources`.
  New object — no mutation of the input.
- **R4:** Real adapter: every `Source.url` is a URL present in Tavily's results;
  `sources.length ≥ 1` or the call throws.
- **R5:** All `PriceRange`s satisfy `0 < min ≤ max` and `currency === config.currency ?? 'EUR'`.
- **R6:** Real adapter: two parallel Tavily searches (resale, rental); one OpenAI JSON-mode
  call reconciles both ranges.
- **R7:** Malformed OpenAI JSON → one retry with a "JSON only" nudge, then throw. Any hard
  API failure (4xx/5xx/network) → throw with a service-naming message. Never resolve with
  fabricated data.
- **R8:** If rental comps are empty, derive `rentPerDay` from the resale midpoint (1.5–3%/day
  band) and reuse the resale sources. If **both** comp sets are empty → throw.
- **R9:** No imports from outside `enrichment/` except `../types.js` and
  `../adapters/types.js`. No `import.meta.env`.
- **R10:** Hour-1 smoke check: a browser `fetch` to Tavily from the dev shell either works or
  the CORS fallback transport is wired — **before** any polish work.

## Error cases you must handle

- **Tavily returns zero useful results for both queries** → nothing to ground on → **throw**
  (a wrong-but-confident price is worse than an error card; the stub keeps the demo alive).
- **Rental comps missing, resale comps present** (common — most objects have resale
  listings, few have rental) → derive `rentPerDay` from the resale-midpoint heuristic
  (~1.5–3%/day), reuse the resale sources. Mark this branch in code.
- **OpenAI returns malformed / non-JSON** → defensive parse, retry once with a "JSON only"
  nudge, then throw.
- **Degenerate numbers** (min > max, ≤ 0, absurd outliers) → swap/clamp after parse; throw
  if still unusable.
- **Tavily browser CORS blocked** (hour-1 risk, design §9) → transport swap confined to
  `tavily-comps.ts` (proxy URL via config or a hosted relay). The interface hides it.
- **Network / HTTP errors, rate limits** → throw with a message naming the failing service.
  Per-item failure isolation is Stream 4's concern (parallel enrich); we just throw cleanly.

Concurrency is a non-issue: the adapter is stateless, each `enrich()` is independent, and
there is no shared mutable state. Stream 4 may call it in parallel per item.

## Architecture (file breakdown)

All in `packages/sdk/src/enrichment/`:

- `index.ts` — factory + barrel (R1). ~30 lines.
- `stub.ts` — offline adapter (R2). Category→price table, hash of `name` for deterministic
  jitter.
- `tavily-comps.ts` — real adapter (R4–R8): query builders → 2× Tavily `fetch` → OpenAI
  reconcile → validate/clamp → `EnrichedItem`. Internal-only shapes (Tavily response,
  reconcile payload) stay private to this file.

**Data models:** frozen `DetectedObject → EnrichedItem` (`PriceRange`, `Source`) — no new
types. **Model:** gpt-4o-mini-class for reconcile.

### Growth points (don't pre-build)

- **New comp source** (eBay API, local classifieds): new file implementing
  `EnrichmentAdapter`, one line in the factory. The seam already exists — no source registry.
- **CORS transport swap:** isolate behind a small `search()` function inside
  `tavily-comps.ts`; only that function changes.
- **Server-side move (post-hackathon):** the adapter body relocates behind a thin endpoint;
  factory + interface unchanged.
- **Per-item currency / price confidence / availability:** new fields on frozen
  `EnrichedItem` → **team decision with Streams 4 & 5** — do not add unilaterally (see below).

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
  with grounded EUR ranges + ≥1 real, clickable source link, in < ~8s.
- The stub prices anything instantly offline (<50ms), so the end-to-end chain always demos.

**Risks accepted:** browser-exposed keys (demo-scoped, rotate after the event); no automated
tests (hackathon cut — smoke-test on real objects); the rent heuristic is a guess band,
defensible enough for a demo.
