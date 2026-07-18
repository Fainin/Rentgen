# @rentgen/sdk

The reusable core of Rentgen: the value chain (**detect → enrich → price → total**) plus
two drop-in Web Component widgets. Framework-agnostic, fully client-side, no backend.

## Install & embed

```bash
npm i @rentgen/sdk lit
```

The widgets are standard Custom Elements — use them from **React, Angular, or plain HTML**.

### Plain HTML

```html
<script type="module">
  import { configureRentgen } from '@rentgen/sdk';
  configureRentgen({ openaiApiKey: '…', tavilyApiKey: '…' }); // omit keys → offline mock data
</script>

<rentgen-scanner></rentgen-scanner>
<rentgen-results></rentgen-results>
```

### React (19+, native custom-element support)

```tsx
import { configureRentgen } from '@rentgen/sdk';
configureRentgen({
  openaiApiKey: import.meta.env.VITE_OPENAI_API_KEY,
  tavilyApiKey: import.meta.env.VITE_TAVILY_API_KEY,
});

export default () => (
  <>
    <rentgen-scanner />
    <rentgen-results />
  </>
);
```

### Angular

Add `CUSTOM_ELEMENTS_SCHEMA` to the module, `import '@rentgen/sdk'`, use the tags.

Dropping both tags on a page is all you need — they coordinate through a shared event bus
(`rentgenEvents`), so a completed scan flows from scanner to results with no wiring.

## Theming

Pure CSS custom properties — style from the host, never touch internals:

| Property | Default | |
|---|---|---|
| `--rentgen-accent` | `#4f46e5` | buttons, total banner, links |
| `--rentgen-card-bg` | `#fff` | item card background |
| `--rentgen-radius` | `14px` | corner radius |
| `--rentgen-font` | `system-ui` | font family |

## The plugin surface (adapters)

Swap or add a data source = implement one interface, register it — no widget/app changes.

| Interface | Job | Built-in default |
|---|---|---|
| `DetectionAdapter` | `detect(imageBase64) → DetectedObject[]` | `OpenAIVisionAdapter` (falls back to stub without a key) |
| `EnrichmentAdapter` | `enrich(object) → EnrichedItem` | `TavilyCompsAdapter` (falls back to stub without keys) |
| `AssetAdapter` | `render(session) → Asset` | none (Phase 3) |

Bring your own via `configureRentgen({ detection, enrichment })`, or construct a
`RentgenClient` directly for full control.

## Scripts

- `npm run typecheck` — `tsc --noEmit`.
- `npm run build` — emit `dist/` + `.d.ts` via **tsup** (for the "real installable
  component" story). The monorepo app consumes `src/` directly, so you don't need this
  for local dev.

## Notes

- API keys live in the browser bundle — a deliberate, demo-scoped trade-off (see the
  design doc §9). Rotate after the event. For production, move `adapters/*` behind a thin
  server; the interfaces don't encode *where* they run, so nothing else changes.
- `imageBase64` accepts a full data URL (`data:image/…;base64,…`) or a bare base64 string.
