# Contributing to Rentgen

Rentgen started as a 1-day hackathon build ({Tech: Europe} × Almedia, Berlin) and stays
deliberately small. Contributions are welcome — the sweet spot is **adapters**.

## Setup

```bash
npm install          # Node ≥ 22 (see .nvmrc), links the npm workspaces
npm run dev          # app shell on http://localhost:5173 — append ?stub=1 for offline mode
npm run typecheck    # tsc --noEmit across sdk + app (CI also checks apps/website)
```

No automated test suite — a deliberate scope cut. Smoke-test your change in the running
app (stub mode works without any API keys) and make sure `npm run typecheck` and
`npm run build` pass.

## The extension point

The whole design is ports & adapters: **adding a data source = writing an adapter**
implementing an interface from `packages/sdk/src/adapters/types.ts` and registering it via
`configureRentgen()` — no widget or app changes. Start with
[`docs/writing-an-enrichment-adapter.md`](../docs/writing-an-enrichment-adapter.md), the
full worked example.

## Ground rules

- **Read [`docs/spec.md`](../docs/spec.md) first.** The types, adapter interfaces, event
  names, element tags, and CSS custom properties listed there are stable contracts —
  changing one is a deliberate, called-out decision, never a side effect.
- **SDK-first.** Reusable logic goes in `@rentgen/sdk`; `apps/app` only launches it. No
  backend, no server-side code.
- **Simplest thing that works.** No speculative abstractions or features.
- TypeScript strict, immutable data (`readonly`, return new objects), small focused files,
  explicit error handling (adapters throw; widgets surface via `scan:error`).
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org):
  `feat: …`, `fix: …`, `docs: …`, etc.

## Pull requests

Branch from `main`, keep PRs focused, and describe what you smoke-tested. CI runs
typecheck + build on every PR.
