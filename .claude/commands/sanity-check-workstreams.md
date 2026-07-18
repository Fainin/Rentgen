---
description: Sanity-check the 5 Rentgen workstream specs for contradictions + drift against the design spec, SDK best-practices, and the real frozen code contracts.
argument-hint: "[optional: a single stream number or file to focus on]"
---

# Sanity check — workstream specs

Audit `docs/specs/workstreams/*.md` for (a) contradictions **between** the specs, (b) drift
from the authoritative docs, and (c) drift from the **real frozen code contracts**. This is a
**read-only audit** — report findings, do **not** silently edit frozen contracts (types.ts,
adapters/types.ts, events.ts, the README registry). Fixing those is a *shared feature* — flag
the owning workstream and let the team decide (per `/CLAUDE.md` scope discipline).

## Sources of truth (priority order)

1. **Design spec** (authoritative): `docs/specs/2026-07-18-rentgen-sdk-design.md`
2. **SDK best-practices** (rationale layer): `docs/sdk-best-practices.md`
3. **Repo `/CLAUDE.md`** (operational + scope rules)
4. **Workstreams README** = the frozen **seam registry**: `docs/specs/workstreams/README.md`
5. **Real code contracts** — the *actual current state*; these **trump prose** when they disagree:
   `packages/sdk/src/types.ts`, `packages/sdk/src/adapters/types.ts`,
   `packages/sdk/src/events.ts` (may not exist yet), `packages/sdk/src/index.ts`

> A file that legitimately doesn't exist yet (events.ts, adapters, widgets) is **not** a finding —
> the repo is a bare scaffold by design (see CLAUDE.md "Current state").

## How to run

**Preferred (exhaustive, multi-agent) — when ultracode / the Workflow tool is available:**

> Run the `sanity-check-workstreams` workflow (`.claude/workflows/sanity-check-workstreams.js`).
> It extracts a ground-truth ledger, fans out one checker per stream + README + a
> cross-contradiction pass + a best-practices pass, then **adversarially verifies every finding**
> (kills false positives like "the mockup differs" when the spec says the mockup is illustrative),
> and runs a completeness critic.

**Fallback (single context)** — work the rubric below by hand and produce the same report shape.

## The rubric — what "consistent" means (check every item)

**A. Frozen-contract fidelity (contract-drift / registry-out-of-sync).** Every spec that names a
contract must match the real code *and* the README registry:
- Domain type fields & optionality (`PriceRange`, `Source`, `DetectedObject`, `EnrichedItem`,
  `ScanResult`, `Session`, `Asset`) — e.g. does any spec treat `EnrichedItem.image?` as **already
  added** when `types.ts` doesn't have it and the README registry doesn't list it?
- Adapter/factory signatures: `detect` / `enrich` / `render`; `createDetectionAdapter`,
  `createEnrichmentAdapter`, `createAssetAdapter` (**optional vs required** config param must agree
  across README ↔ spec).
- Event set & payloads: `scan:start | scan:complete | scan:error`, and any newer event
  (`selection:change {…}`) — is it a **frozen event** in one spec but an **open question** in
  another? Is it in the README event list?
- Custom-element tags: `rentgen-scanner`, `rentgen-results`, `rentgen-upsell`, plus any newer tag
  (`rentgen-report-card`) — registered in one spec but **missing from the README + design-spec §10
  tag list**?
- Theming vars (`--rentgen-accent`, `--rentgen-card-bg`, `--rentgen-radius`, `--rentgen-font`) —
  any spec inventing a new themed value without registering it.
- `totalIdleValue` = Σ resale midpoint `(min+max)/2`; single currency **EUR**;
  `getClient().scan()/consume()`, `configureRentgen()` (incl. the opaque `asset` blob pass-through).

**B. Cross-stream handoff consistency (cross-stream-contradiction).** For every seam, both sides
must describe the **same shape and the same state**:
- per-item image (WS1 produces crop → WS4 adds `image?` + stewards types → WS5 consumes);
- selection sharing (WS4 owns checkboxes/`selection:change` ↔ WS5 exports selected subset);
- semantic dedup / name+category merge (WS1 & WS2 flag it → **WS4 owns it** — confirm no gap);
- the `asset` config pass-through (WS4 forwards ↔ WS5 consumes);
- no two streams claiming the same duty, and no duty every stream assumes another owns.

**C. Best-practice / principle compliance (best-practice-violation).** From
`docs/sdk-best-practices.md`: ports-&-adapters (core never imports a concrete adapter); keys via
factory config, **never `import.meta.env` in the SDK**; theming only via the 4 CSS vars; SemVer
allowlist §7 (covered-symbol change ⇒ "stop & coordinate"; a transport swap is **non-breaking**);
none of the **refuted anti-patterns** appearing as a recommendation; runtime-validation/Zod-on-
frozen-types treated as an **open item needing sign-off**, not as already-decided.

**D. Spec divergence & ambiguity.** Any workstream statement that contradicts the design spec, or
is ambiguous enough that two teammates would build incompatible things.

## Quality bar (avoid noise)

- Report only what a careful reader would actually trip on. No nitpicks.
- **Illustrative ≠ contract:** if a spec says the mockup / a render is illustrative and reaffirms
  the real contract, a mismatch with the mockup is **not** a finding.
- Quote **both** sides of every conflict with file + line-ish refs.
- If `$ARGUMENTS` names a stream/file, focus there but still cross-check its seams against the rest.

## Output

Group findings by severity (**critical → high → medium → low**). For each: the conflicting files,
a one-sentence claim, evidence from both sides, what the source-of-truth says, and the concrete fix
naming the **owning workstream**. End with a short "reconciled / not-a-finding" list so re-runs
don't re-litigate settled items (e.g. the idle-capital-vs-`€197/wk` hero framing).
