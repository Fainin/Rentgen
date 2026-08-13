# Rentgen — Docs

The documentation set, in reading order for a new developer:

| # | File | What it gives you |
|---|---|---|
| 1 | [`concept.md`](concept.md) | **Start here.** The idea, the value chain (capture → detect → enrich → total → export), the design principles, and the PoC-to-product path. |
| 2 | [`spec.md`](spec.md) | The current state: features as built and the **stable contracts** (types, adapter interfaces, events, element tags, CSS vars). Change these only deliberately. |
| 3 | [`../packages/sdk/README.md`](../packages/sdk/README.md) | How to **embed** the SDK — React, Angular, plain HTML — plus theming and the plugin surface. |
| 4 | [`writing-an-enrichment-adapter.md`](writing-an-enrichment-adapter.md) | How to **extend** it: implement an `EnrichmentAdapter`, with the complete real-world example (Tavily comps → OpenAI reconcile). |
| 5 | [`sdk-best-practices.md`](sdk-best-practices.md) | The rationale layer: *why* ports & adapters, configure-once, Lit + custom elements, the SemVer stability allowlist, anti-patterns. |
| — | [`brand/`](brand/README.md) | Logo (SVG master + PNG exports), palette, export how-to. |

App-level docs live next to the apps:
[`apps/app/README.md`](../apps/app/README.md) (the scanner PWA) and
[`apps/website/README.md`](../apps/website/README.md) (the landing page).
Contributing workflow: [`.github/CONTRIBUTING.md`](../.github/CONTRIBUTING.md).

## The 30-second version

> Point your phone at your stuff → an agent identifies each item, prices its resale +
> rent/day → an **idle-capital total** adds up → *"You're sitting on €4,200 doing
> nothing."* 🎤

- **Rentgen** = German *Röntgen* (X-ray — sees through your stuff) + "rent-gen".
- Two workspaces that matter: **`packages/sdk`** (the reusable value chain + drop-in
  widgets) and **`apps/app`** (a thin React launcher). Plus `apps/website` (marketing
  page). No backend anywhere.

Keep `spec.md` in sync with reality — it describes what *is*, not what was planned.
