# Rentgen — Spec (current state)

> Point a phone at your stuff → each item is identified and priced (resale + rent/day) →
> an **idle-capital total** adds up: *"You're sitting on €4,200 doing nothing."*
> Rentgen = German *Röntgen* (X-ray) + "rent-gen".

This is the single spec: the features as built and the contracts that hold.

## Features

1. **Scan** — `<rentgen-scanner>` films a live pan (15 s cap): keyframe chunks stream to
   the vision model *while* filming, so named "provisional" chips appear mid-pan and are
   swapped for priced items as enrichment completes. Tap-to-capture single photos also
   works.
2. **Detect** — Gemini frame-batch detection (one call per pan, dedupes objects across
   frames) is the default; OpenAI vision handles single photos; a deterministic stub runs
   with no keys. Optional `detectionHints` steady naming for known demo inventory.
3. **Price** — each `DetectedObject` is enriched to an `EnrichedItem`: resale range,
   rent-per-day range, source links. The SDK ships a **stub-only** enrichment adapter;
   the real-world implementation (Tavily comps → OpenAI reconcile) lives as a worked
   example in [`writing-an-enrichment-adapter.md`](writing-an-enrichment-adapter.md).
4. **Compile** — `<rentgen-results>` renders item cards + the running idle-capital total
   (`totalIdleValue` = Σ resale midpoints). Sessions persist to `localStorage` with an
   image-hash cache; per-item selection feeds the export.
5. **Upsell** — `<rentgen-upsell>` turns the selected items into a generic listing-export
   bundle. Host apps plug in their own uploader via the `asset` config blob.
6. **Offline mode** — append `?stub=1`: all adapters run deterministic stubs, no keys, no
   network. The demo-safe path.

## Architecture

Two npm-workspace packages, zero backend, everything client-side:

- **`packages/sdk` (`@rentgen/sdk`)** — the reusable value chain (detect → enrich →
  price → total) plus self-registering Lit widgets. Framework-agnostic: React 19 renders
  the tags natively, Angular needs `CUSTOM_ELEMENTS_SCHEMA`, plain HTML just works
  (`examples/plain-html/`).
- **`apps/app`** — thin React (Vite) shell: calls `configureRentgen()` once with the
  `VITE_*` keys and mounts the widgets. The SDK never reads `import.meta.env`.

The scan flow: `getClient().scan(imageBase64)` → localStorage image-hash cache →
`DetectionAdapter` → `EnrichmentAdapter` per object (parallel) → total → persist →
`ScanResult`. Widgets coordinate over the event bus only.

## Contracts (the stable surface — change only deliberately)

- **Types** (`packages/sdk/src/types.ts`): `PriceRange`, `Source`, `BoundingBox`,
  `DetectedObject`, `EnrichedItem`, `ScanResult`, `Session`, `Asset`.
- **Adapter interfaces** (`packages/sdk/src/adapters/types.ts`):
  - `DetectionAdapter.detect(imageBase64) → DetectedObject[]`, optional
    `detectBatch(framesBase64[])` for whole-pan frame batches.
  - `EnrichmentAdapter.enrich(object) → EnrichedItem` — throws on failure, never
    fabricates a price.
  - `AssetAdapter.render(session) → Asset`.
- **Factories**: `createDetectionAdapter(cfg)`, `createEnrichmentAdapter(cfg)`,
  `createAssetAdapter(cfg?)` — each exported from its folder barrel; real adapter when
  keys are present, stub otherwise.
- **Client API**: `configureRentgen(config)` (once, from the host app),
  `getClient().scan(imageBase64)`, `getClient().consume(sessionId)`. Custom adapters
  inject via `configureRentgen({ adapters: { … } })`.
- **Event bus** (`packages/sdk/src/events.ts`): `scan:start`, `scan:detected`
  (provisional objects mid-pan), `scan:complete` (`ScanResult`), `scan:error`,
  `selection:change`.
- **Custom elements**: `<rentgen-scanner>`, `<rentgen-results>`, `<rentgen-upsell>`.
  Self-register on import; never import each other.
- **Theming**: CSS custom properties only — `--rentgen-accent`, `--rentgen-card-bg`,
  `--rentgen-radius`, `--rentgen-font`.

Adding a data source = implement an adapter interface, register it. No widget or app
changes. See [`writing-an-enrichment-adapter.md`](writing-an-enrichment-adapter.md) for
the full worked example.

## Commands

```bash
npm install            # root — links workspaces
npm run dev            # app shell on http://localhost:5173
npm run typecheck      # tsc --noEmit across both packages
npm run build          # SDK (tsup → dist) + app
```

## Known trade-offs

- **API keys sit in the browser bundle** — deliberate, demo-scoped; rotate after events.
  A shipped product would move the adapter bodies behind a thin server; every interface
  stays the same.
- **No automated tests** — deliberate hackathon scope cut; smoke-test on real objects.
- Camera capture needs HTTPS or localhost; the scanner falls back to photo upload.
