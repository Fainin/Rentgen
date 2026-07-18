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

## Reference UI — the result screen (target)

![Result list mockup — detected gadgets with per-item rent/resale, an earnings hero, and a
bottom "List N gadgets" action bar](../../mockup/result-list-mockup.png)

An **example** of the result screen you render (illustrative, not final). You own everything
here **except the bottom action bar**:
- The **"N gadgets found" list** + per-item cards (resale, rent/day, sources, confidence chip,
  photo, and a **selection checkbox**) — `<rentgen-results>`.
- The **earnings hero** — `<rentgen-results>`. **Framing decision (confirmed):** the hero stays
  **idle-capital-first** (*"€4,200 idle. Earning €0."*). The mockup's rent-first *"€197/wk"* is
  only an illustrative render — lead with idle capital; rent/day stays supporting detail, and
  the frozen total contract does **not** change. But the hero UI is **extensible** to *also*
  surface a **passive monthly income** figure — additive, optional, and it doesn't touch the
  total contract (see "Passive-income display" below).
- The **bottom action bar** (`3 selected · …` + the **"List N"** button) is **Stream 5's
  `<rentgen-upsell>`**, mounted in your slot. You render the list + selection state; it renders
  the export actions.

## You own (create these)

- `client/RentgenClient.ts` — `scan(imageBase64)`: image-hash cache → `DetectionAdapter` →
  `EnrichmentAdapter` per object (**parallel**) → compute total → persist → **emit
  `scan:complete`** → return `ScanResult`. Also `consume(sessionId)`.
- `config.ts` — `configureRentgen(config)` / `getClient()`. **Imports the other streams'
  factories** (`createDetectionAdapter`, `createEnrichmentAdapter`, `createAssetAdapter`)
  and picks real-vs-stub by which keys are present. **Forwards an opaque `asset` config blob**
  (Stream 5's `{ auth, providers, uploader, actions, callbacks }`) straight into
  `createAssetAdapter` — you don't read or reshape it, just pass it through.
- `storage/sessionStore.ts` — localStorage wrapper + image-hash cache (instant rehearsal).
- `events.ts` — the event names/payloads (`scan:start|complete|error`, plus
  `selection:change` — see selection contract). **Publish this in hour 1** so everyone else is
  unblocked.
- `results/rentgen-results.ts` — the `<rentgen-results>` element: cards (resale, rent/day,
  sources, confidence chip, photo, **selection checkbox**) + the animated total + the
  extensible hero. Emits **`selection:change`** as items are checked/unchecked.
  `results/total.ts`, `results/format.ts`, `results/earnings.ts` (passive-income helper).
- `index.ts` — the root barrel (re-exports each stream's public surface).
- `apps/app/src/App.tsx` — calls `configureRentgen({ VITE_* keys })`, lays out the headline
  + mounts `<rentgen-scanner>` / `<rentgen-results>` (+ a slot for `<rentgen-upsell>`).

## Your hour-1 deliverable (unblocks everyone)

Publish the seam **with stubs**: `events.ts`, `getClient()`/`configureRentgen` returning a
stub-backed client, and the frozen factory names in the README. After that, Streams 1/2/3/5
build against it in parallel and you swap their real modules in as they land — no rewiring.

## Pre-made decisions (so we don't collide)

- `totalIdleValue` = **Σ of each item's resale midpoint** `(min+max)/2`. Single currency
  (`EUR`). This is the frozen total contract. **The sum runs over list items only** — items that
  fail the sellability gate (next section) never enter the list, so the idle-capital number is
  honest by construction: no hallucinated objects, no junk priced as treasure, no fixtures.
- `RentgenClient` **awaits enrichments with `Promise.all`** (parallel, one call per object).
- The **event bus is the only widget↔widget channel.** Results subscribes to
  `scan:complete`; it never imports the scanner or the client internals.
- Provide a **named slot / mount point** at the **bottom of `<rentgen-results>`** for Stream
  5's `<rentgen-upsell>` action bar (per the Reference UI). You render the list + selection; it
  renders the actions. Don't hard-code upsell logic in results.
- **Selection contract.** `<rentgen-results>` owns the per-item checkboxes and the current
  selection. On every change it emits **`selection:change { sessionId, selectedItemIds }`** on
  the bus; Stream 5's export reads the latest set and lists only the selected subset. Default:
  all items checked. Payload **confirmed with Stream 5 and frozen** in the README seam registry.
- **Passive-income display (demo heuristic).** The extensible hero can show
  *"~€X/month passive"* computed **locally** as a fixed share of each item's resale midpoint
  (**5–10%/month**, one constant, single currency). Pure helper in `results/earnings.ts`; no
  contract change. "AI-estimated passive income" is an optional upgrade — it would need
  **Stream 3** to emit a per-item field (frozen-type change → coordinate). Ship the heuristic.
- Keys stay in `apps/app` env and are passed into `configureRentgen`; the SDK never reads
  `import.meta.env`.

## Sellability gate — only honestly-sellable items make the list

The list is a promise: every card is something a real person could list on a marketplace **today**.
`RentgenClient.scan()` runs a **hard filter before an item enters `ScanResult.items`** — a failed
item is dropped silently (the scan still completes; the total simply doesn't count it). An item
must pass **all** of:

1. **Sellable category.** Not a fixture / structural / non-goods item. Detection (Stream 2)
   refuses these in the prompt, but re-check defensively with a denylist of name/category tokens
   (`wall|floor|ceiling|window|door|radiator|curtain|blind|built-in|pipe|cable|charger|trash|plant|pet|person`).
   Hit ⇒ drop.
2. **Confidence ≥ 0.4 at compile time.** Stream 2 already drops `< 0.3`; the compile floor is
   stricter — a borderline sighting isn't worth a card or a place in the total.
3. **Grounded price.** `sources.length ≥ 1` (a real Tavily comp URL backs the number) **and**
   `resale.max > 0`. No source ⇒ no listing — a price the model invented is worse than a missing
   item. Stream 3 throws on zero comps; this is the defensive backstop if one ever resolves.
4. **Resale midpoint ≥ €5** (constant, single place). A sub-€5 item isn't worth listing and would
   smear the total with rounding noise. Hero demo items clear this trivially.

**Honesty, not pruning for show:** the goal is *never show something that can't honestly be
sold* — not "make the total look big". If a scan returns zero sellable items, the list is empty
and the total is €0; say so plainly. Surface a small "N items hidden — not sellable / unpriced"
counter for the demo operator (not the jury) so the filter is visible, not magic. Stream 2's
prompt is the first line of defense (be honest at the source); this gate is the backstop.

## Agreed handoffs from Streams 1 & 2 (team-confirmed)

Two compile-time duties land here (details in specs 1 & 2, "Design decisions"):

1. **Semantic dedup on compile.** Stream 1's tracker gate + image hash stop most double
   scans, but the same physical object scanned from two angles (or via a Phase-1 photo *and*
   a Phase-2 crop) still slips through. In `RentgenClient`, merge items whose
   `name`+`category` match (case-insensitive) before totaling — keep the higher-confidence
   one. Stream 2's naming rules are designed to make this string-stable.
2. **Persist the scan image as the item image — on `EnrichedItem.image`.** The `imageBase64`
   passed into `scan()` *is* the item image — exactly **one image per item**, ever (Phase 2: a
   single-object crop; a white-background cutout instead if Stream 1's optional Gemini-mask step is
   active — same field, same shape, you can't tell and don't need to). **Contract (confirmed
   with Stream 5):** add an **optional** `readonly image?: string` (data URL) to `EnrichedItem`
   so both `<rentgen-results>` and Stream 5's `photoProvider` read the same `item.image`. This
   is your frozen-type stewardship call — make the edit and update the README registry. Stream
   5 designs against `image?` optional and degrades gracefully if it's ever absent.

## Steward, don't hoard (the frozen files)

You *own* `types.ts`, `adapters/types.ts`, `events.ts`, `config.ts`, `index.ts` — but they
are **shared contracts**. When another stream needs a change here, treat it as a team
decision, make the edit deliberately, and keep the README registry in sync.

**Registry updates confirmed this round (make them + sync the README):**
- `EnrichedItem.image?: string` — optional item photo (handoff #2).
- `selection:change { sessionId, selectedItemIds }` — new bus event (selection contract).
- `rentgen-report-card` — new custom-element tag registered by Stream 5; add it to the frozen
  tag list.
- `configureRentgen` accepts + forwards an opaque `asset` config blob to `createAssetAdapter`.

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
- Per-item **selection** works; `selection:change` fires; Stream 5's action bar mounts in the
  results slot and exports only the selected subset.
- The hero optionally shows a **passive monthly income** line from the local 5–10% heuristic,
  without changing the total contract.
- `npm run dev` boots the assembled app; a rehearsal re-scan is instant (cache hit).
- **Sellability gate** drops non-sellable / ungrounded / sub-€5 items before they reach the list;
  the total reflects only honestly-sellable items (visible via the hidden-items counter).
