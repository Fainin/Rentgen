# Rentgen — Docs (the team's 2nd brain)

Shared context so anyone (human or Claude Code) can get up to speed fast. Read `specs/` first, then start building against the contracts in `CLAUDE.md` (repo root).

## What's here

| File | What it is | When to read it |
|---|---|---|
| [`specs/2026-07-18-rentgen-sdk-design.md`](specs/2026-07-18-rentgen-sdk-design.md) | **Authoritative design & runbook.** SDK-first, two npm-workspace packages, zero backend. Architecture, adapter plugin surface, data flow, build order, team split, timeline, risks. | **First. This is the source of truth.** |
| [`specs/workstreams/`](specs/workstreams/README.md) | **The 5 parallel sub-projects** (detect → classify → price → compile → upsell): per-owner specs, disjoint file ownership, the frozen seam registry, and the merge-conflict rules. | **Before you start coding** — read the README + your own stream. |
| [`sdk-best-practices.md`](sdk-best-practices.md) | **The rationale layer.** Verified research digest behind the design: ports & adapters, configure-once, deep-merge defaults, Lit + `@lit/react`, the SemVer stability allowlist — plus anti-patterns to avoid and open decisions. | When you want the *why* behind a contract, or are weighing an SDK design call. |
| [`archive/2026-07-16-idle-capital-hackathon-design.md`](archive/2026-07-16-idle-capital-hackathon-design.md) | Superseded predecessor. Same product, demo script, and phased build order — but a backend-based architecture we replaced. | For the **demo script & pitch narrative** (§2) and background only. Ignore its architecture (§5). |

## The 30-second version

> Point your phone at your stuff → an agent identifies each item, prices its resale + rent/day against live web comps → an **idle-capital total** adds up → *"You're sitting on €4,200 doing nothing."* 🎤

- **Rentgen** = German *Röntgen* (X-ray — sees through your stuff) + "rent-gen".
- Two packages: **`@rentgen/sdk`** (the reusable value chain + drop-in widgets) and **`apps/app`** (a thin React app that launches it). No backend.
- **Phases are a firewall:** ship Phase 1 (tap → priced items → total) end-to-end before touching Phase 2 (live pan) or Phase 3 (cognee / report card).

## How to keep this brain useful

- Land a decision or hit a gotcha during the hackathon? Add a short note here (a new file under `docs/`, or a line in the relevant spec) so the next person / next Claude session inherits it. Cheap to write, expensive to re-learn at hour 6.
- The specs are copied in verbatim from the design source — treat `specs/` as the canonical intent; capture *deltas* (what we actually did differently) in new notes rather than rewriting the spec.
