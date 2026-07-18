# Workstream 5 — Upselling the results (fainin Export)

**Owner:** _(you — fainin)_ · **Package:** `@rentgen/sdk` · **Your folder:** `packages/sdk/src/upsell/`

> **Read first:** [`/CLAUDE.md`](../../../CLAUDE.md) · the
> [design spec](../2026-07-18-rentgen-sdk-design.md) (§6 Phase 3, §7) · the
> [workstreams README](README.md) (ownership + frozen seam registry).

## Your mission

Turn a finished scan into **action and money** — the "so what?" close, from fainin's own
perspective. Take the `ScanResult` and produce a **fainin-ready export bundle**: clean,
*generic*, richly-enriched listing drafts (cropped photo + generated title/description +
price ranges + sources + extensible attributes) that **fainin uploads on its own side**.

Two hard rules that shape everything below:

- **Rentgen never calls a fainin write API and never learns fainin's listing schema.** We hand
  off a generic bundle; fainin maps it to its own storefront model and does the upload. This
  keeps fainin's API surface private and makes the demo bomb-proof (no live backend to fail).
- **Auth is the host's job.** The fainin app does its own login/signup and *injects* the
  authenticated state into the SDK — exactly like it already injects `VITE_*` API keys. The
  SDK gates export on that state; it never authenticates and never sees credentials.

Alongside the export, keep the **shareable report card** — but as an **extensible** Lit
element with named slots, so fainin can drop its own branding / content / CTA into it.

## Where you fit

```
   (4) ScanResult ──►  YOU: enrich into listing drafts → assemble bundle  ──►  fainin uploads (their side)
                        + render extensible report card
```

You are **downstream of everything** — you consume the compiled result read-only and never
feed back into pricing or classification. Your output is a **data handoff** (the bundle) plus
two widgets (export panel + report card).

## You own (create these)

- `upsell/types.ts` — WS5-local types: `FaininBundle`, `FaininListingDraft`, `ListingAsset`,
  `FaininAuthContext`, `ListingEnricher`, `AssetAdapterConfig`. All ride under the loose
  `Asset` shape (`kind: 'fainin-bundle'`) — **no widening of shared types**.
- `upsell/fainin-export.ts` — implements `AssetAdapter.render(session) → FaininBundle`:
  maps each `EnrichedItem` → a `FaininListingDraft`, runs the configured enricher providers,
  attaches auth/user context, returns the bundle.
- `upsell/enrichers/` — the pluggable **listing-enricher provider** layer (see below).
  Ships `description-provider.ts` (title + description) and `photo-provider.ts` (crop →
  primary photo) as defaults.
- `upsell/rentgen-upsell.ts` — the `<rentgen-upsell>` element: a **purely functional export
  panel**. Subscribes to `scan:complete`; reflects auth state; on click, assembles the bundle
  and fires the handoff.
- `upsell/rentgen-report-card.ts` — the `<rentgen-report-card>` element: a shareable summary
  with **named light-DOM slots** for fainin to extend.
- `upsell/projection.ts` — optional pure helpers (rank by rent/day, monthly projection). Not
  the focus; keep only if cheap.
- `upsell/index.ts` — barrel exporting **`createAssetAdapter(config)`** + both elements.

## The bundle — what fainin receives

The single handoff object. Generic and self-describing; **fainin maps it to its storefront
schema on upload** — we intentionally do *not* map to fainin's taxonomy here.

```ts
interface FaininBundle extends Asset {   // Asset = { kind, ...} — loose by design
  readonly kind: 'fainin-bundle';
  readonly sessionId: string;
  readonly user?: FaininUserRef;         // who it's for, from the auth context
  readonly generatedAt: number;
  readonly currency: string;
  readonly items: readonly FaininListingDraft[];
}

interface FaininListingDraft {
  readonly sourceItemId: string;         // EnrichedItem.id — traceability back to the scan
  readonly title: string;                // generated
  readonly description: string;          // generated
  readonly category: string;             // generic (EnrichedItem.category), NOT fainin taxonomy
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
```

## Auth — host-injected, SDK-gated

```ts
interface FaininAuthContext {
  readonly isAuthenticated: boolean;
  readonly user?: { readonly id: string; readonly displayName?: string };
  readonly getToken?: () => string | Promise<string>;  // OPAQUE — WS5 never inspects it
}
```

- The host passes this into `createAssetAdapter(config)`. The SDK **gates export** on
  `isAuthenticated` and (if present) attaches the token **opaquely** to the bundle/handoff so
  *fainin's* uploader can use it. WS5 never authenticates, never validates, never reads the token.
- The `<rentgen-upsell>` panel reflects the state: signed-out shows a "Sign in to fainin"
  affordance that **requests** sign-in from the host (config callback — see below); signed-in
  shows the export action.

## Enricher provider layer — configurable data sources

Your "configurable data providers that improve enrichment" idea, kept **downstream of
`ScanResult`** and **off Stream 3's core `EnrichmentAdapter`** (pricing). These run at
bundle-assembly time and only ever *add/overwrite fields on a draft*.

```ts
interface ListingEnricher {
  readonly name: string;
  enrich(draft: FaininListingDraft, item: EnrichedItem): Promise<FaininListingDraft>;
}
```

- Run in sequence per item; pure, composable, isolated — easy to reason about and test.
- **Defaults shipped:** `descriptionProvider` (title + description from name/category/condition)
  and `photoProvider` (crop → primary `photo`).
- **Host registers more** via `config.providers` (`brandLookup`, `bgRemoval`,
  `faininCatalogMatch`, MSRP/spec lookups …) — each just enriches the draft. Immutable: return
  a new draft, never mutate the input.
- **Errors are per-item and surfaced, never swallowed:** a provider throwing skips *that
  enrichment* for *that item* and records a warning; the rest of the bundle still exports.

## Public surface & retrieval (two ways, per fainin's ask)

```ts
createAssetAdapter(config: AssetAdapterConfig): AssetAdapter

interface AssetAdapterConfig {
  readonly auth: FaininAuthContext;
  readonly providers?: readonly ListingEnricher[];
  readonly onBundleReady?: (bundle: FaininBundle) => void;   // PUSH
  readonly onSignInRequest?: () => void;                     // widget → host sign-in trigger
}
```

- **Pull (on demand):** `AssetAdapter.render(session) → FaininBundle` — the existing frozen
  seam, unchanged. The host calls `render(consume(sessionId))` any time to re-fetch a fresh
  bundle for a session.
- **Push (callback):** `config.onBundleReady(bundle)` fires when the export panel assembles a
  bundle. The host uploads it fainin-side.

## The report card — extensible via named slots

`<rentgen-report-card>` renders a shareable summary from the `ScanResult` and exposes
**named light-DOM slots** so fainin can inject its own content without WS5 changes:

- `slot="header"` · `slot="badges"` · `slot="cta"` · `slot="footer"`
- Default (unslotted) content renders Rentgen's own summary; any slotted light-DOM overrides
  that region. Theme via CSS custom properties only.

## Your seam

- `createAssetAdapter(config): AssetAdapter` (frozen interface) — Stream 4 registers it.
- `<rentgen-upsell>` and `<rentgen-report-card>` render into the **slot Stream 4 exposes** in
  `<rentgen-results>` (agree the exact mount contract with Stream 4). Each self-registers on
  import and never imports another widget.

## Pre-made decisions (so we don't collide)

- Consume `ScanResult` / `EnrichedItem` **read-only**; never mutate. All derived data lives in
  `upsell/`.
- Bundle stays **generic** — no fainin taxonomy mapping here; fainin owns that on upload.
- `FaininBundle` rides under the loose `Asset` shape (`kind: 'fainin-bundle'`); put all
  upsell-specific fields under your own `kind`, never widen shared types.
- Theme via CSS custom properties only (`--rentgen-accent`, `--rentgen-card-bg`, …).
- Everything in `upsell/`; the only outside imports are the frozen types + the event name
  `scan:complete`.
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
   straight to `createAssetAdapter` untouched, so the host's `{ auth, providers, callbacks }`
   arrives intact.
   - 🔎 **Sanity check:** on init, assert the `asset` config actually arrived (non-null
     `auth`). If it didn't, surface a clear "fainin export not configured" state rather than
     silently rendering a dead panel.

## 🚧 Scope flashpoints — STOP & coordinate (Claude: enforce this)

These still cross frozen contracts or another stream's files. **Do not do them unilaterally** —
name the owning stream and get agreement first.

- **New custom-element tag `rentgen-report-card`** — adding a tag is a **frozen seam-registry**
  change (workstreams README). → get team sign-off before registering it.
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

- After a scan, `<rentgen-upsell>` reflects auth state and, when signed in, produces a
  `FaininBundle` on export — delivered both by **pull** (`render(session)`) and **push**
  (`onBundleReady`) — with generated title/description, price ranges, sources, and (when
  available) a cropped photo per item.
- The bundle is **generic and fainin-schema-free**; fainin uploads it on its own side.
- Enricher providers are pluggable via config, run in sequence, and fail per-item without
  breaking the bundle.
- `<rentgen-report-card>` renders a shareable summary with working named slots for fainin
  content.
- Fully optional: turning WS5 off leaves the Phase-1 demo untouched.
