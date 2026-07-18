# Rentgen

> **Point your phone at your stuff → an agent identifies each item, prices its resale +
> rent/day against live web comps → an idle-capital total adds up.**
> Ends on: *"You're sitting on €4,200 doing nothing."* 🎤

**Rentgen** reads as German *Röntgen* (X-ray — sees through your stuff) and as "rent-gen".
Built for the {Tech: Europe} × Almedia Hackathon, Berlin.

SDK-first, fully client-side, **zero backend**. The value chain ships as a reusable
package (`@rentgen/sdk`); a thin React app (`apps/app`) just launches it.

## Quickstart

```bash
npm install          # links the workspaces
npm run dev          # starts the app on http://localhost:5173
```

Open it, tap **Scan your stuff**, pick any photo → mock item cards + an idle-capital
total appear. **No API keys needed** — it runs offline on stub data out of the box.

### Go live (real OpenAI + Tavily)

```bash
cp apps/app/.env.example apps/app/.env   # then fill in the keys
```

```
VITE_OPENAI_API_KEY=sk-…
VITE_TAVILY_API_KEY=tvly-…
```

Restart `npm run dev`. Keys are demo-scoped and **rotated after the event** — never
commit `.env`.

## Layout

```
packages/sdk/   @rentgen/sdk — value chain + <rentgen-scanner>/<rentgen-results> widgets
apps/app/       thin React (Vite) launcher
docs/           the team's 2nd brain — start at docs/README.md
CLAUDE.md       instructions for Claude Code working in this repo
```

## Scripts

| Command | What |
|---|---|
| `npm run dev` | Run the app (Vite, HMR across packages). |
| `npm run build` | Build the SDK (`dist/` + types) and the app. |
| `npm run typecheck` | Type-check both workspaces. |

## Where to read next

- **[`docs/`](docs/README.md)** — the design, demo script, build order, team split.
- **[`packages/sdk/README.md`](packages/sdk/README.md)** — how to embed the widgets and
  write adapters.

## Build order (phases are a firewall)

1. **Phase 1 (PoC):** tap → priced items → total, end-to-end. ← *this scaffold gets you here*
2. **Phase 2:** live pan with an in-browser detector — only once Phase 1 demos cleanly.
3. **Phase 3 (stretch):** cognee memory, shareable report card.

Don't start a phase until the previous one demos cleanly. See `docs/specs/`.
