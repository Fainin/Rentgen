# @rentgen/sdk

The reusable core of Rentgen: the value chain (**detect → enrich → price → total**) plus
drop-in Web Component widgets. Framework-agnostic, fully client-side, no backend.

Point a camera at your stuff → each item gets a grounded resale + rent-per-day price with
web sources → an idle-capital total adds up.

## Quick start

```ts
import { configureRentgen } from '@rentgen/sdk'; // importing registers the widgets

configureRentgen({
  openaiApiKey: '…', // omit both keys → deterministic offline stub adapters
  tavilyApiKey: '…',
  currency: 'EUR',
});
```

```html
<rentgen-scanner></rentgen-scanner>
<rentgen-results>
  <rentgen-upsell></rentgen-upsell>
</rentgen-results>
```

That's the whole integration: standard Custom Elements, coordinated over an internal
event bus (`scan:start` → `scan:complete` / `scan:error`, `selection:change`). No props,
no framework bindings required.

## Using from React (19+)

React 19 renders custom elements natively — see `apps/app` in this repo for the full
working example. Import the SDK once, call `configureRentgen`, use the tags in JSX.

## Using from Angular

Custom elements need `CUSTOM_ELEMENTS_SCHEMA` so the template compiler accepts unknown
tags:

```ts
// app.component.ts (standalone component)
import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { configureRentgen } from '@rentgen/sdk'; // side effect: registers the elements

@Component({
  selector: 'app-root',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <rentgen-scanner></rentgen-scanner>
    <rentgen-results>
      <rentgen-upsell></rentgen-upsell>
    </rentgen-results>
  `,
})
export class AppComponent implements OnInit {
  ngOnInit(): void {
    configureRentgen({
      openaiApiKey: environment.openaiApiKey,
      tavilyApiKey: environment.tavilyApiKey,
      currency: 'EUR',
      asset: {
        auth: { isAuthenticated: true, user: { id: 'user-123' } },
        uploader: myMarketplaceUploadAdapter, // implements UploadAdapter — your code, your API
      },
    });
  }
}
```

Listening to results from the host (optional):

```ts
import { on } from '@rentgen/sdk';
const off = on('scan:complete', (result) => console.log(result.totalIdleValue));
```

## Using from plain HTML

`npm run build` emits `dist/standalone.js` with every dependency bundled:

```html
<script type="module">
  import { configureRentgen } from './dist/standalone.js';
  configureRentgen({});
</script>
<rentgen-scanner></rentgen-scanner>
<rentgen-results></rentgen-results>
```

Working page: [`examples/plain-html/`](../../examples/plain-html/index.html) at the repo
root (serve over http — camera needs HTTPS or localhost).

## Architecture (the plugin surface)

- `DetectionAdapter.detect(imageBase64) → DetectedObject[]` — default: OpenAI vision
  (gpt-4o, strict JSON schema). Stub without a key.
- `EnrichmentAdapter.enrich(object) → EnrichedItem` — default: Tavily comps (two parallel
  searches) → OpenAI reconcile → grounded price ranges + real source links. Stub without keys.
- `AssetAdapter.render(session) → ExportBundle` — turns a scan into generic, ready-to-list
  listing drafts. Your marketplace maps + uploads them via your own `UploadAdapter`
  (registered through `configureRentgen({ asset: { uploader } })`). Nothing
  marketplace-specific ships in this SDK.

Adding a data source = implement an adapter interface + register it via
`configureRentgen({ adapters: { … } })`. No widget or app changes.

## Theming

CSS custom properties only — never reach into widget internals:
`--rentgen-accent`, `--rentgen-card-bg`, `--rentgen-radius`, `--rentgen-font`.

## Scripts

- `npm run typecheck` — `tsc --noEmit`.
- `npm run build` — `dist/index.js` (+ `.d.ts`, deps external) and `dist/standalone.js`
  (everything bundled) via tsup.

## Notes

- API keys live in the browser bundle — a deliberate, demo-scoped trade-off (design doc
  §9). Rotate after the event. For a shipped product, move the adapter bodies behind a
  thin server; every interface stays the same.
- `imageBase64` accepts a full data URL (`data:image/…;base64,…`) or a bare base64 string.
- Camera capture needs HTTPS or localhost (`getUserMedia` restriction); the scanner falls
  back to photo upload otherwise.
