# Rentgen — Docs

| File | What it is |
|---|---|
| [`spec.md`](spec.md) | **The spec.** Features, architecture, and the stable contracts. Read this first. |
| [`writing-an-enrichment-adapter.md`](writing-an-enrichment-adapter.md) | How to implement an `EnrichmentAdapter`, with a full worked example (Tavily comps → OpenAI reconcile). |
| [`sdk-best-practices.md`](sdk-best-practices.md) | The rationale layer behind the SDK design: ports & adapters, configure-once, Lit + `@lit/react`, the SemVer stability allowlist, anti-patterns to avoid. |
| [`brand/`](brand/README.md) | Logo (SVG master + 1024px PNG), brand colors, export how-to. |

## The 30-second version

> Point your phone at your stuff → an agent identifies each item, prices its resale + rent/day → an **idle-capital total** adds up → *"You're sitting on €4,200 doing nothing."* 🎤

- **Rentgen** = German *Röntgen* (X-ray — sees through your stuff) + "rent-gen".
- Two packages: **`@rentgen/sdk`** (the reusable value chain + drop-in widgets) and **`apps/app`** (a thin React app that launches it). No backend.

Keep `spec.md` in sync with reality — it describes what *is*, not what was planned.
