# website — the Rentgen landing page

The marketing/landing page (React 19 + Vite): hero with an animated scan-loop mockup,
problem statement, how-it-works, SDK pitch, trust section, CTA. Static — it does not
mount the SDK widgets; the hero animation is a self-contained simulation
(`src/hero/useScanLoop.ts` + `src/hero/items.ts`).

## Run

```bash
npm install                  # once, at the repo root
npm run dev:website          # Vite dev server
npm run build:website        # production build → apps/website/dist
npm run typecheck:website    # tsc --noEmit
```

## Structure

| Path | What |
|---|---|
| `src/App.tsx` | Section order — the whole page composition. |
| `src/hero/` | Animated hero: fake scan loop, item grid, total card, currency helpers. |
| `src/sections/` | One file per landing section (Hero, Problem, HowItWorks, SdkPitch, Trust, FinalCta, Footer). |
| `src/styles/global.css` | All styling. |

Brand assets (logo SVG/PNG, palette) come from [`docs/brand/`](../../docs/brand/README.md).

Note: the root `npm run typecheck` / `npm run build` do **not** include this workspace —
CI runs the `:website` variants explicitly (see `.github/workflows/ci.yml`).
