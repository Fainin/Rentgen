# Rentgen — instructions for Claude Code

> **Read `docs/specs/2026-07-18-rentgen-sdk-design.md` first — it is the source of truth.** This file is the fast operational summary. For the *why* behind the SDK design (ports & adapters, configure-once, deep-merge defaults, Lit + `@lit/react`, the SemVer stability allowlist, and anti-patterns to avoid), see `docs/sdk-best-practices.md`.

## What this is

Point a phone at your stuff → an agent identifies each item, prices its **resale + rent/day** against live web comps → an **idle-capital total** adds up. A 1-day hackathon build. Name: *Röntgen* (X-ray) + "rent-gen".

## Current state

**Bare scaffold + locked contracts.** In place: the monorepo, tooling, docs, and the SDK **types + adapter interfaces** (`packages/sdk/src/types.ts`, `adapters/types.ts`). NOT yet built: adapters, `RentgenClient`, storage, widgets, app wiring. Everything below the "Architecture" heading is the **target** to build against — the files it names mostly don't exist yet. `npm run dev` currently boots a headline-only shell.

## Guiding principles (do not violate)

1. **PoC-first.** Build the dumbest thing that proves the value, end-to-end, *then* make it fancy. Each phase is independently demo-able.
2. **SDK-first.** The value chain (detect → enrich → price → total) lives in `@rentgen/sdk` as reusable, framework-agnostic code. `apps/app` only *launches* it — keep app-specific logic out of the SDK, and keep the SDK free of app/Vite specifics.
3. **Phases are a firewall.** Don't start Phase 2 (live pan) until Phase 1 demos cleanly. Don't start Phase 3 (cognee, report card) until Phase 2 is solid.
4. **No backend.** Everything is client-side. Persistence = `localStorage`. Adapters call OpenAI/Gemini/Tavily directly from the browser (demo-scoped keys — see gotchas). Model split: **gpt-5.6-luna** (OpenAI, hero detection — Pflicht-Partner), **gemini-flash-latest** (live-pan + price reconcile), **Tavily** (comps).

## Architecture

Two npm-workspace packages, zero backend:

- **`packages/sdk` (`@rentgen/sdk`)** — the reusable core:
  - `adapters/` — the **plugin surface**. `DetectionAdapter` (photo → objects), `EnrichmentAdapter` (object → priced item + sources), `AssetAdapter` (Phase 3). Defaults: `openai-vision`, `tavily-comps`. `stub.ts` powers the offline demo.
  - `client/RentgenClient.ts` — orchestrates `scan()`: cache → detect → enrich (parallel) → total → persist. Also `consume(sessionId)`.
  - `storage/sessionStore.ts` — `localStorage` wrapper + image-hash cache.
  - `widgets/` — Lit custom elements `<rentgen-scanner>` / `<rentgen-results>`; they coordinate via the `events.ts` bus. Theme with CSS custom properties only.
  - `config.ts` — `configureRentgen()` / `getClient()` singleton.
- **`apps/app`** — thin React (Vite) shell that calls `configureRentgen()` and mounts the two widgets.

**Adding a data source = write an adapter implementing the interface, register it in `configureRentgen`/`RentgenClient`. No widget or app changes.** That's the whole point.

## Contracts (locked — don't casually change; the team builds against these)

See `packages/sdk/src/types.ts` and `adapters/types.ts`:
- `DetectionAdapter.detect(imageBase64) → DetectedObject[]`
- `EnrichmentAdapter.enrich(object) → EnrichedItem` (`resale`, `rentPerDay`, `sources`)
- `RentgenClient.scan(imageBase64) → ScanResult` (`items`, `totalIdleValue`)
- `totalIdleValue` = Σ of each item's resale midpoint.
- `imageBase64` = a data URL or bare base64.

## Commands

```bash
npm install            # root — links workspaces
npm run dev            # boot the app shell (Vite)
npm run typecheck      # tsc --noEmit across both packages
npm run build          # SDK (tsup → dist) + app
```

## Conventions

- **TypeScript strict.** **Lit** for widgets (needs `experimentalDecorators` + `useDefineForClassFields:false` — already in `tsconfig.base.json`).
- **Immutability.** Return new objects; never mutate a value you received. Types are `readonly`.
- **Small, focused files** (200–400 lines). Organize by domain, not by type.
- **Handle errors explicitly.** Adapters throw on API failure; widgets surface it via the `scan:error` event. Never silently swallow.
- **Theme via CSS custom properties** (`--rentgen-accent`, `--rentgen-card-bg`, `--rentgen-radius`, `--rentgen-font`) — never reach into widget internals.
- **Keys:** host app passes `VITE_*` env values into `configureRentgen`. The SDK never reads `import.meta.env` itself (stays framework-agnostic). **Never commit `.env`.**

## Known gotchas / risks

- **Tavily browser CORS (test hour 1, not demo day).** Direct browser calls may be blocked. If so, only swap the *transport* inside `tavily-comps.ts` — the interface hides where the call runs, so nothing else moves.
- **API keys are in the browser bundle** — a deliberate, demo-scoped trade-off. Rotate after the event. For a shipped product, move `adapters/*` behind a thin server; the rest is unchanged.
- **No automated tests** — deliberate hackathon scope cut. Smoke-test on real venue objects; keep a recorded fallback video.

## Team split — 5 parallel workstreams

The team builds five independent sub-projects, each owning a **disjoint** folder so we merge
with (near) zero conflicts. Full per-owner specs live in
[`docs/specs/workstreams/`](docs/specs/workstreams/README.md) — **read the workstreams
README + your own stream's spec before writing code.**

| # | Workstream | Owns | Exposes |
|---|------------|------|---------|
| 1 | Object detection from video stream | `packages/sdk/src/capture/**` | `<rentgen-scanner>` |
| 2 | Object classification "What is this?" | `packages/sdk/src/detection/**` | `createDetectionAdapter()` |
| 3 | Product live research + population | `packages/sdk/src/enrichment/**` | `createEnrichmentAdapter()` |
| 4 | Compile Results with "wow effect" | `client/**`, `config.ts`, `storage/**`, `results/**`, `events.ts`, `index.ts`, `apps/app/**` | `RentgenClient`, `configureRentgen`, `<rentgen-results>` — **integration hub** |
| 5 | Upselling the results | `packages/sdk/src/upsell/**` | `createAssetAdapter()`, `<rentgen-upsell>` |

Build the `stub` for your seam first so the app runs end-to-end offline — then nobody is
blocked while the real modules land behind the same frozen interfaces.

## 🚧 Scope discipline (ALWAYS enforce when working inside a workstream)

When a task would require any of these, **do not do it silently** — pause and tell the
developer it's a **shared feature**, name the **owning workstream/teammate**, and say what
needs agreeing before diverging:

- editing a **frozen contract** — `packages/sdk/src/types.ts`, `adapters/types.ts`,
  `events.ts`, or the seam registry in the workstreams README;
- adding/renaming a **shared event, custom-element tag, factory signature, or CSS variable**;
- changing the **shape of data** handed off between streams;
- editing **another workstream's files**.

Then proceed only on the parts fully inside the current stream's folder. A short teammate
message is cheaper than untangling a merge. This rule overrides "just get it done."
