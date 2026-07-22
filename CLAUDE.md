# Rentgen — instructions for Claude Code

> **Read `docs/spec.md` first — the single simplified spec (features + contracts).** This file is the fast operational summary. For the *why* behind the SDK design (ports & adapters, configure-once, Lit + `@lit/react`, the SemVer stability allowlist, anti-patterns to avoid), see `docs/sdk-best-practices.md`.

## What this is

Point a phone at your stuff → an agent identifies each item, prices its **resale + rent/day** → an **idle-capital total** adds up. Built at a 1-day hackathon (2026-07-18), now post-event. Name: *Röntgen* (X-ray) + "rent-gen".

## Current state

**Shipped and working end-to-end.** Live-pan scanning (Gemini frame-batch detection) and tap-to-capture → item cards → idle-capital total → per-item selection → listing-export bundle. Enrichment ships **stub-only** — the real Tavily-comps adapter was removed post-event and survives as a worked example in `docs/writing-an-enrichment-adapter.md`. `?stub=1` forces fully-offline stub adapters.

## Guiding principles (do not violate)

1. **Simplest thing that works.** PoC-first; no speculative features or abstractions.
2. **SDK-first.** The value chain (detect → enrich → price → total) lives in `@rentgen/sdk` as reusable, framework-agnostic code. `apps/app` only *launches* it — keep app-specific logic out of the SDK, and keep the SDK free of app/Vite specifics.
3. **No backend.** Everything is client-side. Persistence = `localStorage`. Adapters call model/search APIs directly from the browser (demo-scoped keys — see gotchas).

## Architecture

Two npm-workspace packages, zero backend:

- **`packages/sdk` (`@rentgen/sdk`)** — the reusable core:
  - `adapters/types.ts` — the **plugin surface**: `DetectionAdapter`, `EnrichmentAdapter`, `AssetAdapter`.
  - `capture/`, `detection/`, `enrichment/`, `upsell/` — one folder per pipeline stage, each with a `create*Adapter()` factory barrel and a stub. Detection defaults: `gemini-vision` (frame batches) / `openai-vision` (single photos).
  - `client/RentgenClient.ts` — orchestrates `scan()`: cache → detect → enrich (parallel) → total → persist. Also `consume(sessionId)`.
  - `storage/sessionStore.ts` — `localStorage` wrapper + image-hash cache.
  - Widgets: Lit custom elements `<rentgen-scanner>` / `<rentgen-results>` / `<rentgen-upsell>`; they coordinate via the `events.ts` bus only. Theme with CSS custom properties only.
  - `config.ts` — `configureRentgen()` / `getClient()` singleton.
- **`apps/app`** — thin React (Vite) shell that calls `configureRentgen()` and mounts the widgets.

**Adding a data source = write an adapter implementing the interface, register it via `configureRentgen`. No widget or app changes.** That's the whole point. Worked example: `docs/writing-an-enrichment-adapter.md`.

## Contracts (stable — don't casually change)

See `packages/sdk/src/types.ts` and `adapters/types.ts` (full registry in `docs/spec.md`):
- `DetectionAdapter.detect(imageBase64) → DetectedObject[]` (+ optional `detectBatch(frames[])`)
- `EnrichmentAdapter.enrich(object) → EnrichedItem` (`resale`, `rentPerDay`, `sources`)
- `RentgenClient.scan(imageBase64) → ScanResult` (`items`, `totalIdleValue`)
- `totalIdleValue` = Σ of each item's resale midpoint.
- `imageBase64` = a data URL or bare base64.
- Events: `scan:start` / `scan:detected` / `scan:complete` / `scan:error` / `selection:change`.

Changing any of these (types, adapter interfaces, factory signatures, event names, element tags, CSS vars) is a deliberate decision — say so explicitly, don't drive it through as a side effect of another task.

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

- **API keys are in the browser bundle** — a deliberate, demo-scoped trade-off. Rotate after events. For a shipped product, move the adapter bodies behind a thin server; the rest is unchanged.
- **No automated tests** — deliberate scope cut. Smoke-test on real objects.
- **Tavily browser CORS** — historical: direct browser calls worked; the note lives in `docs/writing-an-enrichment-adapter.md`.
