# Workstream 5 — Upselling the results (Listing Export)

**Owner:** _(you)_ · **Package:** `@rentgen/sdk` · **Your folder:** `packages/sdk/src/upsell/`

> **Read first:** [`/CLAUDE.md`](../../../CLAUDE.md) · the
> [design spec](../2026-07-18-rentgen-sdk-design.md) (§6 Phase 3, §7) · the
> [workstreams README](README.md) (ownership + frozen seam registry).

## Your mission

Turn a finished scan into **action and money** — the "so what?" close. Take the `ScanResult`
and produce a **generic, ready-to-list export bundle**: clean listing drafts (cropped photo +
generated title/description + price ranges + sources + extensible attributes) that a **host
app uploads to its own marketplace**.

This is a **standalone SDK**. Keep it that way:

- **No customer-specific code or types in this repo.** `@rentgen/sdk` is a reusable,
  framework-agnostic component. fainin is simply the **first customer** — their upload logic,
  API schema, branding, and auth all live in **fainin's own codebase**, which *consumes*
  `@rentgen/sdk`. Nothing named `fainin`, no fainin endpoints, no fainin schema belongs here.
- **The SDK produces a generic bundle; the customer maps and uploads it.** Rentgen never calls
  a marketplace write API and never learns any marketplace's listing schema. It hands off a
  self-describing bundle; the host maps it to its own model and uploads.
- **Auth is the host's job.** The host app does its own login/signup and *injects* the
  authenticated state into the SDK — like it already injects `VITE_*` API keys. The SDK gates
  export on that state; it never authenticates and never sees credentials.
- **Upload is the customer's job, via an optional adapter seam.** The SDK defines an
  `UploadAdapter` interface and ships **no real implementation** (a no-op/console stub at
  most). The host implements it in *their* code and registers it through config — the same
  adapter-pattern the whole SDK is built on.

Alongside the export, keep the **shareable report card** — an **extensible** Lit element with
named slots, so any host can drop its own branding / content / CTA into it.

## Where you fit

```
   (4) ScanResult ──►  YOU: enrich into listing drafts → assemble bundle  ──►  host app uploads (its side)
                        + render extensible report card
```

You are **downstream of everything** — you consume the compiled result read-only and never
feed back into pricing or classification. Your output is a **generic data handoff** (the
bundle) plus two widgets (export panel + report card).

## You own (create these)

- `upsell/types.ts` — WS5-local types: `ExportBundle`, `ListingDraft`, `ListingAsset`,
  `AuthContext`, `UploadAdapter`, `UploadResult`, `ListingEnricher`, `AssetAdapterConfig`. All
  ride under the loose `Asset` shape (`kind: 'export-bundle'`) — **no widening of shared types**.
- `upsell/export.ts` — implements `AssetAdapter.render(session) → ExportBundle`: maps each
  `EnrichedItem` → a `ListingDraft`, runs the configured enricher providers, attaches
  auth/user context, returns the bundle.
- `upsell/enrichers/` — the pluggable **listing-enricher provider** layer (see below). Ships
  `description-provider.ts` (title + description) and `photo-provider.ts` (crop → primary
  photo) as defaults.
- `upsell/rentgen-upsell.ts` — the `<rentgen-upsell>` element: the **export action bar** shown
  at the bottom of the result screen (see Reference UI). Subscribes to `scan:complete`; reflects
  auth state; shows the selection summary + a primary **"List N"** button that runs the
  configured export action(s) — assembling the bundle from the **selected** items, firing the
  push callback, and calling the registered uploader/action.
- `upsell/rentgen-report-card.ts` — the `<rentgen-report-card>` element: a shareable summary
  with **named light-DOM slots** for the host to extend.
- `upsell/projection.ts` — optional pure helpers (rank by rent/day, monthly projection). Not
  the focus; keep only if cheap.
- `upsell/index.ts` — barrel exporting **`createAssetAdapter(config)`** + both elements + the
  public types the host implements against (`UploadAdapter`, `ExportBundle`, `AuthContext`).

## Reference UI — the result screen (target)

![Result list mockup — a checklist of detected gadgets with per-item rent/resale, an earnings
hero, and a bottom "List N gadgets" action bar](../../mockup/result-list-mockup.png)

An **example** of the later result screen (illustrative, not final). Most of it — the
"3 gadgets found" list, the per-item cards, and the "You could earn €197/wk" hero — is
**Stream 4's `<rentgen-results>`** ("compile results with wow effect"). WS5 owns the **bottom
action bar**: the selection summary (`3 selected · €197/wk`) and the primary **"List N gadgets"**
button.

That button is your **export surface**, and it must support **more than one action** — e.g.
*Upload to fainin* (the host's `UploadAdapter`), plus alternatives like *download the bundle* or
*share the report card*. Model it as a small set of host-configured `ExportAction`s (see config),
with the registered `uploader` as the primary one; render a menu / split-button when several are
configured.

Two details from the mockup that shape the contract:
- **Only *checked* items export.** "Uncheck anything you'll keep" → the bundle contains the
  **selected subset**, not every detected item. The checkboxes live in the results list — see the
  selection flashpoint below.
- The **hero earnings** (`€197/wk`, `€2,810 if you sell instead`) can reuse `projection.ts` pure
  helpers, but are **rendered by Stream 4**, not WS5.

## The bundle — the generic handoff

The single handoff object. Generic and self-describing; **the host maps it to its own
storefront schema on upload** — we intentionally do *not* map to any marketplace taxonomy here.

```ts
interface ExportBundle extends Asset {   // Asset = { kind, ...} — loose by design
  readonly kind: 'export-bundle';
  readonly sessionId: string;
  readonly user?: UserRef;               // who it's for, from the host-injected auth context
  readonly generatedAt: number;
  readonly currency: string;
  readonly items: readonly ListingDraft[];
}

interface ListingDraft {
  readonly sourceItemId: string;         // EnrichedItem.id — traceability back to the scan
  readonly title: string;                // generated
  readonly description: string;          // generated
  readonly category: string;             // generic (EnrichedItem.category), NOT a host taxonomy
  readonly condition: string;
  readonly salePrice: PriceRange;        // = EnrichedItem.resale
  readonly rentPricePerDay: PriceRange;  // = EnrichedItem.rentPerDay
  readonly photo?: ListingAsset;         // from EnrichedItem.image — see "Assumed upstream" #1
  readonly sources: readonly Source[];   // provenance behind the price
  readonly attributes: Record<string, unknown>; // brand / model / EAN / specs … from providers
}

interface ListingAsset {
  readonly kind: 'image';
  readonly mimeType: string;
  readonly role: 'primary' | 'gallery';
  readonly dataUrl?: string;             // inline base64 — demo-friendly, no hosting needed
  readonly url?: string;                 // OR a hosted reference path, if a provider uploads it
}

interface UserRef { readonly id: string; readonly displayName?: string }
```

## Upload — the customer's adapter (SDK defines it, host implements it)

The SDK owns the **interface**; the host owns the **implementation**. This keeps every
marketplace's API and schema out of this repo.

```ts
interface UploadAdapter {
  upload(bundle: ExportBundle): Promise<UploadResult>;
}
interface UploadResult {
  readonly ok: boolean;
  readonly uploaded: number;             // how many drafts were accepted
  readonly message?: string;
}
```

The bottom "List N" button can expose **multiple** export actions (see Reference UI). Each is a
host-supplied `ExportAction`; the registered `uploader` is surfaced as the primary
"upload"-type action.

```ts
interface ExportAction {
  readonly id: string;
  readonly label: string;                // e.g. "List on fainin", "Download bundle", "Share card"
  run(bundle: ExportBundle): Promise<UploadResult | void> | UploadResult | void;
}
```

- Ships **no real uploader** — at most a `stubUploader` that logs the bundle, so the demo runs
  offline and nothing here talks to an external service.
- The host (fainin, first) implements `UploadAdapter` in **its own** codebase and registers it
  via `config.uploader`. When present, the export panel's action calls `uploader.upload(bundle)`
  and reflects the `UploadResult`. When absent, the panel simply fires the push callback and
  the host uploads however it likes.

## Auth — host-injected, SDK-gated

```ts
interface AuthContext {
  readonly isAuthenticated: boolean;
  readonly user?: UserRef;
  readonly getToken?: () => string | Promise<string>;  // OPAQUE — WS5 never inspects it
}
```

- The host passes this into `createAssetAdapter(config)`. The SDK **gates export** on
  `isAuthenticated` and (if present) attaches the token **opaquely** to the bundle/handoff so
  the *host's* uploader can use it. WS5 never authenticates, never validates, never reads the token.
- The `<rentgen-upsell>` panel reflects the state: signed-out shows a "Sign in to export"
  affordance that **requests** sign-in from the host (config callback — see below); signed-in
  shows the export action.

## Enricher provider layer — configurable data sources

The "configurable data providers that improve enrichment" idea, kept **downstream of
`ScanResult`** and **off Stream 3's core `EnrichmentAdapter`** (pricing). These run at
bundle-assembly time and only ever *add/overwrite fields on a draft*.

```ts
interface ListingEnricher {
  readonly name: string;
  enrich(draft: ListingDraft, item: EnrichedItem): Promise<ListingDraft>;
}
```

- Run in sequence per item; pure, composable, isolated — easy to reason about and test.
- **Defaults shipped:** `descriptionProvider` (title + description from name/category/condition)
  and `photoProvider` (crop → primary `photo`).
- **Host registers more** via `config.providers` (brand lookup, background removal, catalog
  match, MSRP/spec lookups …) — each just enriches the draft. Immutable: return a new draft,
  never mutate the input.
- **Errors are per-item and surfaced, never swallowed:** a provider throwing skips *that
  enrichment* for *that item* and records a warning; the rest of the bundle still exports.

## Public surface & retrieval (two ways)

```ts
createAssetAdapter(config: AssetAdapterConfig): AssetAdapter

interface AssetAdapterConfig {
  readonly auth?: AuthContext;
  readonly providers?: readonly ListingEnricher[];
  readonly uploader?: UploadAdapter;                          // host's upload code (primary action)
  readonly actions?: readonly ExportAction[];                 // extra "List N" button actions
  readonly onExportReady?: (bundle: ExportBundle) => void;    // PUSH
  readonly onSignInRequest?: () => void;                      // widget → host sign-in trigger
}
```

- **Pull (on demand):** `AssetAdapter.render(session) → ExportBundle` — the existing frozen
  seam, unchanged. The host calls `render(consume(sessionId))` any time to re-fetch a fresh
  bundle for a session.
- **Push (callback):** `config.onExportReady(bundle)` fires when the export panel assembles a
  bundle. The host uploads it on its side (directly, or via the registered `uploader`).

## The report card — extensible via named slots

`<rentgen-report-card>` renders a shareable summary from the `ScanResult` and exposes
**named light-DOM slots** so any host can inject its own content without WS5 changes:

- `slot="header"` · `slot="badges"` · `slot="cta"` · `slot="footer"`
- Default (unslotted) content renders Rentgen's own summary; any slotted light-DOM overrides
  that region. Theme via CSS custom properties only.

## Pre-made decisions (so we don't collide)

- Consume `ScanResult` / `EnrichedItem` **read-only**; never mutate. All derived data lives in
  `upsell/`.
- Bundle stays **generic** — no host/marketplace taxonomy mapping here; the host owns that on
  upload.
- `ExportBundle` rides under the loose `Asset` shape (`kind: 'export-bundle'`); put all
  upsell-specific fields under your own `kind`, never widen shared types.
- Theme via CSS custom properties only (`--rentgen-accent`, `--rentgen-card-bg`, …).
- Everything in `upsell/`; the only outside imports are the frozen types + the event names
  `scan:complete` and `selection:change` (both frozen in the README seam registry).
- Sign-in trigger uses a **config callback** (`onSignInRequest`), NOT a new bus event — stays
  off the frozen `events.ts`.
- **Phase discipline:** this is Phase 3. Don't start until the Phase-1 end-to-end demo is green
  (README golden rules) — a broken export must never block the core demo.

## ✅ Assumed upstream (already designed by other streams — verify, don't rebuild)

Treat these as **done and available** — the owning streams designed them, so build straight
against them rather than re-coordinating. Each carries a quick **sanity check** so a silent
gap surfaces early instead of at demo time.

1. **Cropped photo on each item.** **Stream 1** (capture) attaches a best-frame crop and
   **Stream 4** added the **optional** `readonly image?` field to the frozen types, so a
   per-item photo rides in on `EnrichedItem`. WS5's `photoProvider` maps it to the primary
   `photo`.
   - 🔎 **Sanity check:** confirm `item.image` is actually populated before relying on it. If
     it's missing/empty, **degrade gracefully** — export without a photo (or a placeholder) so
     the bundle still ships — and flag it; never fail the whole export over a missing image.
2. **`configureRentgen` pass-through.** **Stream 4** forwards an opaque `asset` config blob
   straight to `createAssetAdapter` untouched, so the host's `{ auth, providers, uploader,
   callbacks }` arrives intact.
   - 🔎 **Sanity check:** on init, assert the `asset` config actually arrived. If it didn't,
     surface a clear "export not configured" state rather than silently rendering a dead panel.

## 🚧 Scope flashpoints — STOP & coordinate (Claude: enforce this)

These still cross frozen contracts or another stream's files. **Do not do them unilaterally** —
name the owning stream and get agreement first.

- **Custom-element tag `rentgen-report-card`** — ✅ **resolved / already frozen.** It is already
  registered as an S5-owned tag in the README seam registry, so build it directly — no further
  sign-off needed. (Adding any *new* tag beyond it would still be a seam-registry change →
  coordinate.)
- **Item selection state** — ✅ **resolved / mechanism already frozen.** The result list's
  checkboxes ("N selected", "uncheck anything you'll keep") live in **Stream 4's
  `<rentgen-results>`**; WS5 exports only the *selected* subset by subscribing to the frozen
  `selection:change { sessionId, selectedItemIds }` bus event (S4-owned, payload confirmed with
  S5 — see the README seam registry). Don't invent a field or render your own item list.
- You need a **price/field the result doesn't carry** (availability, price confidence,
  per-item currency) → **Stream 3** emits pricing, **Stream 4** owns the shape → agree first.
- You need results to **restructure its layout/slot** for your widgets → **Stream 4**.
- Claude: if a task needs data the `ScanResult` doesn't already contain, **stop, name the
  owning stream (1, 3, or 4), and ask me to coordinate** — don't invent a field or reach into
  their files.

## Do NOT touch (frozen / other owners)

`types.ts`, `adapters/types.ts`, `events.ts`, `config.ts`, `index.ts`, `results/**`,
`enrichment/**`, `capture/**`, `detection/**`. You render *beside* results; you don't edit them.

## Definition of done

- After a scan, `<rentgen-upsell>` renders the bottom action bar (selection summary + "List N"
  button, per the Reference UI), reflects auth state, and — when signed in — produces an
  `ExportBundle` of the **selected** items on export, delivered both by **pull**
  (`render(session)`) and **push** (`onExportReady`), with generated title/description, price
  ranges, sources, and (when available) a cropped photo per item.
- The "List N" button runs the configured export action(s) — the host's `uploader` as primary,
  plus any extra `actions` (e.g. download bundle, share card).
- The bundle is **generic and marketplace-schema-free**; the host uploads it on its own side,
  optionally via a host-registered `UploadAdapter`.
- **No customer-specific code, names, or schema** live in this repo — fainin is a consumer, not
  a dependency.
- Enricher providers are pluggable via config, run in sequence, and fail per-item without
  breaking the bundle.
- `<rentgen-report-card>` renders a shareable summary with working named slots for host content.
- Fully optional: turning WS5 off leaves the Phase-1 demo untouched.
