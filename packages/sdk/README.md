# @rentgen/sdk

The reusable core of Rentgen: the value chain (**detect → enrich → price → total**) plus
two drop-in Web Component widgets. Framework-agnostic, fully client-side, no backend.

> **STATUS: contracts only.** The domain types (`src/types.ts`) and the adapter plugin
> interfaces (`src/adapters/types.ts`) are locked so the team can build against a stable
> API. Everything below describes the **target** design — implementations are TODO.

## What exists today

- `src/types.ts` — `PriceRange`, `Source`, `DetectedObject`, `EnrichedItem`, `ScanResult`,
  `Session`, `Asset`.
- `src/adapters/types.ts` — the plugin surface: `DetectionAdapter`, `EnrichmentAdapter`,
  `AssetAdapter`.
- `src/index.ts` — re-exports the above (types only).

## To build (see CLAUDE.md for the full architecture)

- `adapters/` — `openai-vision` (`DetectionAdapter`), `tavily-comps` (`EnrichmentAdapter`),
  and a `stub` pair for the offline demo.
- `client/RentgenClient.ts` — orchestrate `scan()`: cache → detect → enrich (parallel) →
  total → persist; plus `consume(sessionId)`.
- `storage/sessionStore.ts` — localStorage wrapper + image-hash cache.
- `widgets/` — Lit custom elements `<rentgen-scanner>` / `<rentgen-results>`.
- `config.ts` — `configureRentgen()` / `getClient()` singleton.

## Target API (once implemented)

Standard Custom Elements, usable from **React, Angular, or plain HTML**:

```html
<script type="module">
  import { configureRentgen } from '@rentgen/sdk';
  configureRentgen({ openaiApiKey: '…', tavilyApiKey: '…' }); // omit keys → offline mock data
</script>

<rentgen-scanner></rentgen-scanner>
<rentgen-results></rentgen-results>
```

Theming via CSS custom properties (`--rentgen-accent`, `--rentgen-card-bg`,
`--rentgen-radius`, `--rentgen-font`). Adding a data source = implement an adapter
interface, register it — no widget/app changes.

## Scripts

- `npm run typecheck` — `tsc --noEmit`.
- `npm run build` — emit `dist/` + `.d.ts` via **tsup**.

## Notes

- API keys will live in the browser bundle — a deliberate, demo-scoped trade-off (design
  doc §9). Rotate after the event.
- `imageBase64` accepts a full data URL (`data:image/…;base64,…`) or a bare base64 string.
