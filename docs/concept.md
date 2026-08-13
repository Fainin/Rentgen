# The Rentgen concept

> **Rentgen** = German *Röntgen* (X-ray — it sees through your stuff) + "rent-gen".
> Point a phone at your room → every item is identified and priced → an idle-capital
> total climbs: *"You're sitting on €4,200 doing nothing."*

This doc explains the **idea and the design** — why the project is shaped the way it is
and how the pieces work together. The precise current-state contracts live in
[`spec.md`](spec.md); the research-backed rationale for each design rule lives in
[`sdk-best-practices.md`](sdk-best-practices.md).

## The pitch

Most households sit on thousands of euros of idle hardware — cameras, consoles,
tools, instruments — earning nothing. Rentgen makes that number *visible* and
*actionable*: film your room, watch each item get a resale and rent-per-day price, see
the total, then export the items you select as ready-to-list drafts for any marketplace.

## The value chain

Everything reduces to one pipeline, and the whole codebase is organized around it:

```
capture ──► detect ──► enrich ──► total ──► export
(camera)    (vision     (pricing    (Σ resale   (listing
             model)      + sources)  midpoints)  bundle)
```

1. **Capture** — `<rentgen-scanner>` films a live pan (15 s cap) and streams keyframe
   chunks to detection *while filming*, or takes a single tap-to-capture photo.
2. **Detect** — a `DetectionAdapter` turns frames into `DetectedObject`s (name,
   category, condition, confidence, bounding box, retail estimate). Defaults: Gemini
   for frame batches, OpenAI vision for single photos, a deterministic stub with no keys.
3. **Enrich** — an `EnrichmentAdapter` prices each object into an `EnrichedItem`:
   resale range, rent-per-day range, source links. Ships stub-only; the real-world
   recipe is the worked example in
   [`writing-an-enrichment-adapter.md`](writing-an-enrichment-adapter.md).
4. **Total** — `<rentgen-results>` renders item cards and the headline totals
   (`totalIdleValue` = Σ resale midpoints). Per-item selection updates them live.
5. **Export** — `<rentgen-upsell>` turns the selection into a generic listing bundle;
   the host app plugs in its own uploader.

The user-visible timeline maps onto the event bus: `scan:start` → `scan:detected`
(named provisional chips appear mid-pan) → `scan:complete` (chips swap for priced
cards) or `scan:error`, plus `selection:change` as the user toggles items.

## Design principles

**SDK-first.** The value chain is the product. It lives entirely in `@rentgen/sdk` as
framework-agnostic code; `apps/app` is a thin launcher that could be rewritten in an
afternoon. Anything reusable belongs in the SDK; anything app-specific stays out of it.

**Ports & adapters.** The core (`RentgenClient`) orchestrates against three interfaces —
`DetectionAdapter`, `EnrichmentAdapter`, `AssetAdapter` — and never against a concrete
vendor API. Swapping or adding a data source means implementing one interface and
registering it via `configureRentgen({ adapters: { … } })`. **No widget or app changes.**
That property is the whole point of the architecture; protect it.

**Configure once.** The host app calls `configureRentgen(config)` a single time with its
keys and options; everything else reads the resulting singleton via `getClient()`. The
SDK never touches `import.meta.env` — keys always arrive from the host, keeping the SDK
build-tool-agnostic.

**Widgets are standard Custom Elements.** Built with Lit, self-registering on import,
coordinating *only* over the event bus — they never import each other. React 19 renders
the tags natively, Angular needs `CUSTOM_ELEMENTS_SCHEMA`, plain HTML just works.
Theming is CSS custom properties only (`--rentgen-accent`, `--rentgen-card-bg`,
`--rentgen-radius`, `--rentgen-font`) — reaching into widget internals is forbidden.

**No backend.** Persistence is `localStorage` (sessions + an image-hash cache so
re-scanning the same view is free). Adapters call model APIs directly from the browser.
Fully offline demo mode: append `?stub=1` and every adapter runs a deterministic stub.

**Simplest thing that works.** Born at a 1-day hackathon ({Tech: Europe} × Almedia,
Berlin, 2026-07-18) and kept PoC-first: no speculative abstractions, no automated test
suite (smoke-test in the running app), small focused files.

## From PoC to product

The known gap between demo and product is deliberate and localized:

- **Keys in the browser bundle.** Demo-scoped trade-off. Productizing = moving the
  adapter *bodies* behind a thin server; every interface, widget, and app stays
  identical. The seams were designed so this is a transplant, not a rewrite.
- **Stub pricing.** The enrichment stub returns deterministic plausible numbers. A real
  adapter (live comps → reconciled price ranges + sources) is fully documented in
  [`writing-an-enrichment-adapter.md`](writing-an-enrichment-adapter.md) — implementing
  one is the single highest-value contribution to this repo.
- **npm publishing.** `@rentgen/sdk` builds to `dist/` (tsup) but is currently consumed
  only inside the workspace; publishing needs an exports/packaging pass.

## Where to go next

- Contracts and current feature state: [`spec.md`](spec.md)
- Embedding the SDK (React / Angular / plain HTML): [`../packages/sdk/README.md`](../packages/sdk/README.md)
- Writing an adapter: [`writing-an-enrichment-adapter.md`](writing-an-enrichment-adapter.md)
- Why each rule exists: [`sdk-best-practices.md`](sdk-best-practices.md)
