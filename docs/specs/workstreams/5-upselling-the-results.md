# Workstream 5 — Upselling the results

**Owner:** _(you)_ · **Package:** `@rentgen/sdk` · **Your folder:** `packages/sdk/src/upsell/`

> **Read first:** [`/CLAUDE.md`](../../../CLAUDE.md) · the
> [design spec](../2026-07-18-rentgen-sdk-design.md) (§6 Phase 3, §7) · the
> [workstreams README](README.md) (ownership + frozen seam registry).

## Your mission

Turn a finished scan into **action and money** — the "so what?" close. Take the
`ScanResult` and produce: *"Rent these 5 things → €380/month"*, a monthly-earnings
projection, a **shareable report card** (+ QR → fainin), and a CO₂/sustainability line.
This is the Phase-3 `AssetAdapter` layer and the upsell UI.

## Where you fit

```
   (4) ScanResult ──►  YOU: rank + project + render upsell  ──►  shareable Asset / call-to-action
```

You are **downstream of everything** — you consume the compiled result and never feed back
into pricing or classification.

## You own (create these)

- `upsell/report-card.ts` — implements `AssetAdapter.render(session) → Asset` (a shareable
  report-card image/spec + QR payload).
- `upsell/rentgen-upsell.ts` — the `<rentgen-upsell>` element: subscribes to
  `scan:complete`, renders the projection / "list top 3 for rent" CTA / report-card button.
- `upsell/projection.ts` — pure helpers: rank items by rent/day, monthly projection, CO₂
  estimate. **Pure functions, easy to reason about.**
- `upsell/index.ts` — barrel exporting **`createAssetAdapter(config?)`** + the element.

## Your seam

- `createAssetAdapter(config?): AssetAdapter` (frozen interface) — Stream 4 registers it.
- `<rentgen-upsell>` renders into the **slot Stream 4 exposes** in `<rentgen-results>`
  (agree the exact mount contract with Stream 4).

## Pre-made decisions (so we don't collide)

- Consume `ScanResult`/`EnrichedItem` **read-only**; never mutate them. All derived numbers
  (monthly projection, ranking, CO₂) are computed in `upsell/` from existing fields.
- `Asset` stays the loose `{ kind, ... }` shape; put upsell-specific fields under your own
  `kind` (e.g. `kind: 'report-card'`) rather than widening shared types.
- Theme via CSS custom properties only; match the results look (`--rentgen-accent`, …).
- Everything in `upsell/`; outside imports = frozen types + the event name `scan:complete`.
- **Phase discipline:** this is Phase 3. Don't start until the Phase-1 end-to-end demo is
  green (README golden rules) — a broken upsell must never block the core demo.

## Do NOT touch (frozen / other owners)

`types.ts`, `adapters/types.ts`, `events.ts`, `config.ts`, `index.ts`, `results/**`,
`enrichment/**`. You render *beside* results; you don't edit results.

## 🚧 Stop & coordinate if…

- you need a **price/field the result doesn't carry** (e.g. availability, price confidence,
  per-item currency) → **Stream 3** emits pricing, **Stream 4** owns the shape → agree first.
- the **report card / QR needs a real fainin target** or a new external integration → raise
  it with the team; it's a shared dependency, not a solo edit.
- you need results to **restructure its layout/slot** for your UI → **Stream 4**.
- Claude: if a task needs data the `ScanResult` doesn't already contain, **stop, name the
  owning stream (3 or 4), and ask me to coordinate** — don't invent a field or reach into
  their files.

## Definition of done

- After a scan, `<rentgen-upsell>` shows a monthly-earnings projection + a "list top 3"
  CTA, and can produce a shareable report card — all derived purely from `ScanResult`.
- Fully optional: turning it off leaves the Phase-1 demo untouched.
