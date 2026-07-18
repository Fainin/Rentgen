# Rentgen — Workstreams (parallel build map)

Five people, five sub-projects, one merge. This folder has **one spec per workstream**.
Each of you owns a disjoint slice of the codebase so we can build in parallel and merge
with (near) zero conflicts. **Read this file first, then your stream's spec.**

> Read before anything: [`/CLAUDE.md`](../../../CLAUDE.md) (repo root) and
> [`../2026-07-18-rentgen-sdk-design.md`](../2026-07-18-rentgen-sdk-design.md) (source of
> truth). This file **refines** that spec's illustrative file tree into per-owner folders;
> every **contract** in it (types, adapter interfaces, scan→result→total, no backend,
> theming) stays exactly as-is.

## The pipeline (bottom → top of the whiteboard)

```
[1] video stream ──► [2] "what is this?" ──► [3] live price research ──► [4] compile + WOW ──► [5] upsell
    capture/crop         classify object         populate comps            total + render        monetize
```

Each stage hands the next a **frozen data shape**, so you build against the shape, not
against your neighbor's half-finished code.

## Ownership map — who creates what

| # | Workstream | You create (own exclusively) | You expose (the seam others use) | Spec |
|---|------------|------------------------------|----------------------------------|------|
| 1 | Object detection from video stream | `packages/sdk/src/capture/**` | `<rentgen-scanner>` element; calls `getClient().scan(img)` | [1](1-object-detection-video-stream.md) |
| 2 | Object classification "What is this?" | `packages/sdk/src/detection/**` | `createDetectionAdapter(cfg): DetectionAdapter` | [2](2-object-classification.md) |
| 3 | Product live research + population | `packages/sdk/src/enrichment/**` | `createEnrichmentAdapter(cfg): EnrichmentAdapter` | [3](3-live-research-and-population.md) |
| 4 | Compile Results with "wow effect" | `client/**`, `config.ts`, `storage/**`, `results/**`, `events.ts`, `index.ts`, `apps/app/**` | `RentgenClient`, `configureRentgen`, `<rentgen-results>`, the event names | [4](4-compile-results-wow-effect.md) |
| 5 | Upselling the results | `packages/sdk/src/upsell/**` | `createAssetAdapter(cfg?): AssetAdapter`; `<rentgen-upsell>` | [5](5-upselling-the-results.md) |

**Stream 4 is the integration hub.** It owns every shared wiring file, so streams 1/2/3/5
never edit `config.ts`, `index.ts`, `events.ts`, or `RentgenClient`. Stream 4's hour-1 job
is to publish the seam below (with stubs) so everyone is unblocked immediately.

## 🔒 Frozen seam registry — code against THIS, not each other's files

These are the only cross-stream contracts. **Changing anything here is a team decision**
(see "shared contracts" rule). They already live in code or are published by Stream 4 in
hour 1.

**Domain types** — `packages/sdk/src/types.ts` (exists):
`PriceRange`, `Source`, `DetectedObject`, `EnrichedItem`, `ScanResult`, `Session`, `Asset`.
- `EnrichedItem.image?: string` — optional item photo (data URL): the scan image persisted per
  item. Read by `<rentgen-results>` and Stream 5's `photoProvider`. (Added by S4 — handoff #2.)

**Adapter interfaces** — `packages/sdk/src/adapters/types.ts` (exists):
`DetectionAdapter.detect(imageBase64) → DetectedObject[]`,
`EnrichmentAdapter.enrich(object) → EnrichedItem`,
`AssetAdapter.render(session) → Asset`.

**Factory functions** each stream must export from its folder barrel (so Stream 4 can wire
them without touching your code):
- Stream 2 → `createDetectionAdapter(config): DetectionAdapter`
- Stream 3 → `createEnrichmentAdapter(config): EnrichmentAdapter`
- Stream 5 → `createAssetAdapter(config?): AssetAdapter`

**Custom-element tags:** `rentgen-scanner` (S1), `rentgen-results` (S4), `rentgen-upsell` (S5),
`rentgen-report-card` (S5). A widget **self-registers** on import and **never imports another widget**.

**Event bus** — `packages/sdk/src/events.ts` (published by S4, then frozen). The only
channel between widgets:
- `scan:start` `{}` — a scan began (show a spinner).
- `scan:complete` `ScanResult` — a scan finished; results + upsell render from this.
- `scan:error` `{ message: string }` — surface it.
- `selection:change` `{ sessionId: string, selectedItemIds: string[] }` — result-list selection
  changed; Stream 5 exports only the selected subset. (S4 owns; payload confirmed with S5.)

**Client API:** `getClient().scan(imageBase64) → Promise<ScanResult>`,
`getClient().consume(sessionId) → Session | null`, `configureRentgen(config)`. `configureRentgen`
also accepts an opaque `asset` config blob (Stream 5's `{ auth, providers, uploader, actions,
callbacks }`) and forwards it untouched to `createAssetAdapter`.

**Theming (CSS custom properties):** `--rentgen-accent`, `--rentgen-card-bg`,
`--rentgen-radius`, `--rentgen-font`. Need a new one? Add it here first.

## 🥇 Golden rules (how we avoid merge conflicts)

1. **Own your folder; never edit another stream's files.** Different files = no conflicts.
2. **Frozen files change only by team agreement:** `types.ts`, `adapters/types.ts`,
   `events.ts`, this registry. They are *shared features* — see the guardrail below.
3. **Code against the seam registry**, not another stream's implementation.
4. **Stub first.** Ship a working stub for your seam before the real thing, so downstream
   is never blocked. (`getClient()` already defaults to a stub-backed client offline.)
5. **Cross-stream comms = event bus + factory seam only.** No direct cross-stream imports;
   the *only* thing you import from outside your folder is frozen types/interfaces.
6. **Root `index.ts` + `config.ts` are Stream-4 only.** Need a new public export? Add it to
   **your** folder barrel and ping Stream 4 — don't edit theirs.
7. **Immutability + small files** (see `/CLAUDE.md` conventions). Return new objects.

## 🚧 Scope guardrail — when to STOP and coordinate (Claude: enforce this)

If finishing a task would require any of the following, **do not do it unilaterally**:
- editing a **frozen contract** (`types.ts`, `adapters/types.ts`, `events.ts`) or this
  registry,
- adding/renaming a **shared event, tag name, factory signature, or CSS variable**,
- changing the **shape of data** you hand off or receive,
- editing **another stream's files**.

Instead: **pause, tell the developer it's a shared feature, name the owning stream/teammate,
and say what needs agreeing** before diverging. A 30-second message is cheaper than a merge
untangle. Then proceed only on the parts fully inside your folder.
