# Rentgen

<img src="docs/brand/rentgen-xray-box-1024.png" width="96" align="right" alt="Rentgen logo — X-rayed box revealing a green €">

> **Point your phone at your stuff → an agent identifies each item, prices its resale + rent/day → an idle-capital total adds up.**
> Ends on: *"You're sitting on €4,200 doing nothing."* 🎤

**Rentgen** reads as German *Röntgen* (X-ray — sees through your stuff) and as "rent-gen". Built at the {Tech: Europe} × Almedia Hackathon, Berlin; now open source under [Apache-2.0](LICENSE).

SDK-first, fully client-side, **zero backend**. The value chain (**detect → enrich → price → total → export**) ships as a reusable, framework-agnostic package (`@rentgen/sdk`); a thin React app just launches it.

> **STATUS: working end-to-end.** Live-pan scanning *and* tap-to-capture → vision
> classification → stub pricing → idle-capital total → per-item selection → generic
> listing-export bundle. Runs fully offline on stub adapters (`?stub=1`) or with live
> detection keys. Pricing ships stub-only — the real-world enrichment adapter is
> documented as a worked example.
> No automated tests — a deliberate hackathon scope cut; we smoke-test on real objects.

## Quickstart

```bash
npm install          # links the workspaces (Node ≥ 22, see .nvmrc)
npm run dev          # boots the scanner app on http://localhost:5173
npm run typecheck    # type-checks sdk + app
```

Append `?stub=1` to the URL to force the offline stub adapters — no keys, no network,
always works. For live detection:

```bash
cp apps/app/.env.example apps/app/.env   # then fill in the keys
```

```
VITE_GEMINI_API_KEY=…   # live-pan frame-batch detection (default scanner path)
VITE_OPENAI_API_KEY=…   # single-photo detection
```

Keys are demo-scoped and end up in the browser bundle — a deliberate PoC trade-off
(details in [SECURITY.md](.github/SECURITY.md)). Use disposable keys, rotate them, and
never commit `.env`.

## Repository map

| Path | What | README |
|---|---|---|
| `packages/sdk/` | **`@rentgen/sdk`** — the value chain + `<rentgen-scanner>` / `<rentgen-results>` / `<rentgen-upsell>` widgets | [packages/sdk](packages/sdk/README.md) |
| `apps/app/` | The scanner app — thin React (Vite) launcher, PWA shell | [apps/app](apps/app/README.md) |
| `apps/website/` | Marketing/landing page (React + Vite, static) | [apps/website](apps/website/README.md) |
| `examples/plain-html/` | Portability proof: the widgets mounted with zero framework | — |
| `docs/` | Concept, spec, adapter guide, design rationale, brand | [docs](docs/README.md) |
| `.github/` | CI (typecheck + build), contributing, security policy | [CONTRIBUTING](.github/CONTRIBUTING.md) |
| `CLAUDE.md` | Instructions for Claude Code working in this repo | — |

## Documentation — where to read next

New here? Read in this order:

1. **[docs/concept.md](docs/concept.md)** — the idea, the value chain, the design principles.
2. **[docs/spec.md](docs/spec.md)** — features as built + the stable contracts (types, adapters, events, tags, CSS vars).
3. **[packages/sdk/README.md](packages/sdk/README.md)** — embedding the SDK in React, Angular, or plain HTML.
4. **[docs/writing-an-enrichment-adapter.md](docs/writing-an-enrichment-adapter.md)** — extending it with your own data source (the highest-value contribution).
5. **[docs/sdk-best-practices.md](docs/sdk-best-practices.md)** — the rationale behind every design rule.

## Scripts

| Command | What |
|---|---|
| `npm run dev` | Run the scanner app (Vite, HMR across packages). |
| `npm run build` | Build the SDK (`dist/` + types) and the app. |
| `npm run typecheck` | Type-check sdk + app. |
| `npm run dev:website` / `build:website` / `typecheck:website` | Same for the landing page. |

CI runs all of the above on every push and PR ([.github/workflows/ci.yml](.github/workflows/ci.yml)).

## Contributing

The architecture is ports & adapters — **adding a data source = implementing one
adapter interface**, no widget or app changes. Start with
[CONTRIBUTING.md](.github/CONTRIBUTING.md); mind the stable contracts listed in
[docs/spec.md](docs/spec.md). Security reports: [SECURITY.md](.github/SECURITY.md).

## License

[Apache-2.0](LICENSE) © the Rentgen contributors.
