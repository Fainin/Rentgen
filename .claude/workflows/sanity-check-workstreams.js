export const meta = {
  name: 'sanity-check-workstreams',
  description: 'Cross-check the 5 Rentgen workstream specs against each other, the authoritative design spec + SDK best-practices, and the real frozen code contracts; adversarially verify every finding.',
  whenToUse: 'Run whenever a workstream spec, the design spec, the SDK best-practices, the seam registry, or the frozen types/adapters change — to catch contradictions and contract drift before they become merge pain.',
  phases: [
    { title: 'Extract ground truth', detail: 'Read the real code contracts + registry + stability rules into one ledger' },
    { title: 'Check each source', detail: 'One agent per workstream + README + a cross-contradiction + a best-practices pass' },
    { title: 'Verify', detail: 'Adversarially verify each candidate finding — real, reconciled elsewhere, or false positive?' },
    { title: 'Completeness critic', detail: 'Ask what an exhaustive pass would still be missing' },
  ],
}

// ---------------------------------------------------------------------------
// Configuration (override any of these via the Workflow `args` object).
// Paths use forward slashes; the Read tool accepts them on win32. Agents that
// hit a path error should Glob for the basename under the repo root.
// ---------------------------------------------------------------------------
const cfg = (typeof args === 'object' && args) || {}
const REPO = cfg.repo || 'D:/hackathon/Rentgen'
const WS = cfg.workstreamsDir || REPO + '/docs/specs/workstreams'

const AUTH = {
  designSpec: REPO + '/docs/specs/2026-07-18-rentgen-sdk-design.md',
  bestPractices: REPO + '/docs/sdk-best-practices.md',
  claudeMd: REPO + '/CLAUDE.md',
  registry: WS + '/README.md',
}

const CODE = {
  types: REPO + '/packages/sdk/src/types.ts',
  adapterTypes: REPO + '/packages/sdk/src/adapters/types.ts',
  eventsMaybe: REPO + '/packages/sdk/src/events.ts',
  indexTs: REPO + '/packages/sdk/src/index.ts',
}

// One entry per per-owner spec. `owns` is a hint only; agents verify against files.
const STREAMS = cfg.streams || [
  { n: 1, name: 'Object detection from video stream', file: WS + '/1-object-detection-video-stream.md', owns: 'packages/sdk/src/capture/**' },
  { n: 2, name: 'Object classification', file: WS + '/2-object-classification.md', owns: 'packages/sdk/src/detection/**' },
  { n: 3, name: 'Live research + population', file: WS + '/3-live-research-and-population.md', owns: 'packages/sdk/src/enrichment/**' },
  { n: 4, name: 'Compile results (integration hub)', file: WS + '/4-compile-results-wow-effect.md', owns: 'client/**, config.ts, storage/**, results/**, events.ts, index.ts, apps/app/**' },
  { n: 5, name: 'Upselling the results', file: WS + '/5-upselling-the-results.md', owns: 'packages/sdk/src/upsell/**' },
]

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const GT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ledger: {
      type: 'string',
      description: 'A precise normalized ledger of the CURRENT ground truth: (a) every domain type in types.ts with its exact fields incl. optionality; (b) the adapter interface method signatures; (c) whether events.ts exists and, if so, its event names+payloads; (d) the README seam registry as written — event names, custom-element tags, factory signatures, theming vars, total contract; (e) the stability/allowlist rules from the design spec §10 and best-practices §7. Quote exact identifiers.',
    },
    codeVsRegistryDeltas: {
      type: 'array',
      description: 'Places where the README registry / design spec already disagree with the real code (e.g. a field the registry lists that types.ts lacks). Empty array if none.',
      items: { type: 'string' },
    },
  },
  required: ['ledger', 'codeVsRegistryDeltas'],
}

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', description: 'short kebab-case slug, unique-ish' },
          title: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          category: {
            type: 'string',
            enum: ['contract-drift', 'cross-stream-contradiction', 'registry-out-of-sync', 'best-practice-violation', 'spec-divergence', 'ambiguity', 'other'],
          },
          files: { type: 'array', items: { type: 'string' }, description: 'repo-relative paths involved' },
          claim: { type: 'string', description: 'one sentence: what is inconsistent' },
          evidence: { type: 'string', description: 'concrete quotes / line refs from each conflicting side' },
          authoritative: { type: 'string', description: 'what the source-of-truth (design spec / best-practices / real code) says should hold' },
          recommendation: { type: 'string', description: 'the concrete fix, and which workstream owns making it' },
          owner: { type: 'string', description: 'owning workstream number or "team", if applicable' },
        },
        required: ['id', 'title', 'severity', 'category', 'files', 'claim', 'evidence', 'recommendation'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    isReal: { type: 'boolean', description: 'true only if this is a genuine, un-reconciled inconsistency a reader would trip on' },
    verdict: { type: 'string', enum: ['confirmed', 'reconciled-elsewhere', 'false-positive', 'needs-human-decision'] },
    severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
    rationale: { type: 'string', description: 'why this verdict — cite the reconciling text if reconciled-elsewhere' },
    recommendation: { type: 'string' },
    owner: { type: 'string' },
  },
  required: ['id', 'isReal', 'verdict', 'severity', 'rationale', 'recommendation'],
}

// ---------------------------------------------------------------------------
// Prompt helpers
// ---------------------------------------------------------------------------
const READ_NOTE =
  'Read files with the Read tool (absolute paths, forward slashes are fine on win32). If a path errors, Glob for the basename under the repo root. Do NOT edit any file — this is a read-only audit.'

const SOURCES_BLOCK = `Authoritative sources (source of truth, in priority order):
1. Design spec (authoritative): ${AUTH.designSpec}
2. SDK best-practices (rationale layer): ${AUTH.bestPractices}
3. Repo CLAUDE.md (operational rules incl. scope discipline): ${AUTH.claudeMd}
4. Workstreams README = the frozen seam registry: ${AUTH.registry}
Real frozen code contracts (the ACTUAL current state — trumps prose when they disagree):
- Domain types: ${CODE.types}
- Adapter interfaces: ${CODE.adapterTypes}
- events.ts (may NOT exist yet — its absence is expected, not a finding): ${CODE.eventsMaybe}
- Public barrel: ${CODE.indexTs}`

function checkPrompt(stream, gt) {
  return `You are auditing ONE Rentgen workstream spec for internal-consistency defects.

TARGET SPEC: Workstream ${stream.n} — ${stream.name}
FILE: ${stream.file}
(Owns: ${stream.owns})

${SOURCES_BLOCK}

GROUND-TRUTH LEDGER (already extracted from the real code + registry — treat as authoritative current state; do not re-derive it, but DO cross-check the spec against it):
"""
${gt.ledger}
"""
Known code-vs-registry deltas already noted: ${JSON.stringify(gt.codeVsRegistryDeltas)}

${READ_NOTE}

Find every place where THIS spec:
- contradicts the design spec or the SDK best-practices (spec-divergence / best-practice-violation);
- describes a frozen contract (a type field, an adapter/factory signature, an event name+payload, a custom-element tag, a CSS theming var, the totalIdleValue formula, currency) differently from the REAL code or from the README seam registry (contract-drift / registry-out-of-sync);
- asserts as DONE / "assumed upstream" something that is not actually reflected in the code or registry yet (contract-drift) — e.g. treating an optional field as already added when types.ts lacks it;
- makes a promise another stream depends on that is stated differently in that other stream (cross-stream-contradiction — flag it here; the cross pass will also catch it);
- is internally ambiguous or under-specified in a way that would cause two teammates to build incompatible things (ambiguity).

Rules for quality:
- Only report things a careful reader would actually trip on. Do NOT invent nitpicks.
- "The mockup / an illustrative render differs from the real contract" is NOT a finding IF the spec explicitly says the mockup is illustrative and reaffirms the real contract. Check for that reconciliation before reporting.
- A file legitimately not existing yet (events.ts, adapters, widgets) is NOT a finding — the repo is a bare scaffold by design (see CLAUDE.md "Current state").
- Give exact quotes and file:line-ish evidence for BOTH sides of every conflict.

Return findings via the structured schema. Empty array if the spec is clean.`
}

function readmePrompt(gt) {
  return `You are auditing the Rentgen workstreams README — the FROZEN SEAM REGISTRY — for defects.
FILE: ${AUTH.registry}

${SOURCES_BLOCK}

GROUND-TRUTH LEDGER:
"""
${gt.ledger}
"""
Known code-vs-registry deltas already noted: ${JSON.stringify(gt.codeVsRegistryDeltas)}

${READ_NOTE}

The README registry is supposed to be the single list every stream codes against. Find where it:
- omits a contract that a workstream spec relies on (e.g. an event, a custom-element tag, a type field, a factory param) — registry-out-of-sync;
- lists something the real code contradicts (contract-drift);
- disagrees with the design spec §10 stability allowlist or the best-practices §7 allowlist;
- states a factory/API signature (e.g. createAssetAdapter optional vs required config; getClient().scan/consume; configureRentgen accepting an opaque asset blob) differently from how the streams use it.

Same quality rules as the per-stream audit: exact quotes both sides; reconciled/illustrative items are not findings; not-yet-built files are not findings. Return via schema.`
}

function crossPrompt(gt) {
  return `You are running the CROSS-STREAM CONTRADICTION pass for Rentgen. Read ALL of these and compare them against EACH OTHER (not just against the source of truth):
- README registry: ${AUTH.registry}
- WS1: ${STREAMS[0].file}
- WS2: ${STREAMS[1].file}
- WS3: ${STREAMS[2].file}
- WS4: ${STREAMS[3].file}
- WS5: ${STREAMS[4].file}

${SOURCES_BLOCK}

GROUND-TRUTH LEDGER:
"""
${gt.ledger}
"""

${READ_NOTE}

Hunt specifically for HANDOFF MISMATCHES between neighboring streams — where stream X promises/consumes something in one shape and stream Y describes the same thing in a different shape or state. Concretely check every shared seam:
- The per-item image: is 'EnrichedItem.image?' described consistently across WS1 (produces crop), WS4 (adds the field / stewards types.ts), WS5 (assumes it done)? Does the README registry and the real types.ts agree with all three?
- Selection: 'selection:change { sessionId, selectedItemIds }' — is it a frozen event (WS4) or an open question (WS5)? Is it in the README event list?
- The 'rentgen-report-card' tag — registered by WS5, stewarded by WS4; is it in the README frozen tag list and the design spec §10 tag list?
- The 'asset' config blob pass-through in configureRentgen (WS4 forwards, WS5 consumes) — consistent + in the registry?
- Semantic dedup (name+category merge): WS1 & WS2 say "not ours, flag to WS4"; does WS4 actually own it? Consistent ownership?
- totalIdleValue formula, currency (EUR), scan()/consume() signatures, the scan:* event set — identical wording everywhere?
- Any place two streams claim to own the same thing, or each assumes the other owns it (ownership gap).

Report each mismatch once, naming BOTH streams and quoting BOTH. Same quality rules. Return via schema.`
}

function bestPracticePrompt(gt) {
  return `You are running the BEST-PRACTICES / DESIGN-PRINCIPLE compliance pass for the Rentgen workstream specs.
Read the best-practices doc and the design spec in full, then all 5 specs + the README.
- Best-practices: ${AUTH.bestPractices}
- Design spec: ${AUTH.designSpec}
- README: ${AUTH.registry}
- Specs: ${STREAMS.map((s) => s.file).join('  |  ')}

${SOURCES_BLOCK}

GROUND-TRUTH LEDGER:
"""
${gt.ledger}
"""

${READ_NOTE}

Flag any spec that violates or contradicts a stated best-practice or principle, e.g.:
- Ports & adapters: core (RentgenClient/config) importing a concrete adapter instead of the interface; an adapter reaching outside its folder for non-frozen types.
- Configure-once / keys: any spec reading import.meta.env inside the SDK, or not passing keys via factory config.
- Deep-merge / replace-arrays override semantics; adapters replaced wholesale (not merged).
- Framework-agnostic Lit core; theming ONLY via the 4 documented CSS custom properties (a spec inventing a new themed value without registering it is a finding).
- SemVer allowlist §7: a spec proposing to change a covered symbol without the "stop & coordinate" ceremony; or claiming a transport swap is breaking (it is NOT).
- The explicitly-REFUTED anti-patterns table (e.g. aggressive implicit data collection, a centralized plugin registry with initialize() lifecycle, plugins interacting only via a shared appContext) showing up as a recommendation in any spec.
- Runtime validation at seams (open item): note if a spec assumes Zod-on-frozen-types is already decided (it needs team sign-off) vs. correctly flags it.

Same quality rules: real violations only, quote the principle and the violating text. Return via schema.`
}

function verifyPrompt(f, gt) {
  return `Adversarially verify ONE candidate finding from the Rentgen workstream sanity check. Your DEFAULT posture is skeptical: try to REFUTE it. Many "contradictions" are actually reconciled by nearby text (e.g. a spec says "the mockup is illustrative; the real contract is X") or describe files that legitimately don't exist yet in a bare scaffold.

CANDIDATE FINDING:
${JSON.stringify(f, null, 2)}

${SOURCES_BLOCK}

GROUND-TRUTH LEDGER:
"""
${gt.ledger}
"""

${READ_NOTE}

Open the cited files and read the surrounding context on BOTH sides. Decide:
- verdict 'confirmed' + isReal true — a genuine inconsistency a teammate would build wrong from. Keep/adjust severity.
- verdict 'reconciled-elsewhere' + isReal false — the apparent conflict is explicitly resolved by text the finding ignored. Cite that text.
- verdict 'false-positive' + isReal false — misreading, or a not-yet-built file, or an illustrative example treated as contract.
- verdict 'needs-human-decision' + isReal true — a real open contract question the docs deliberately leave to the team (name who must decide).

Severity guide: critical = will cause a broken merge or two incompatible implementations of a frozen contract; high = a frozen-contract/registry drift that misleads a builder; medium = confusing but low blast-radius; low = wording/polish.
Return the verdict via schema, preserving the finding id.`
}

function criticPrompt(gt, confirmed) {
  return `You are the COMPLETENESS CRITIC for the Rentgen workstream sanity check. A team just produced this set of CONFIRMED findings:
${JSON.stringify(confirmed.map((c) => ({ id: c.id, title: c.title, category: c.category, files: c.files })), null, 2)}

${SOURCES_BLOCK}

GROUND-TRUTH LEDGER:
"""
${gt.ledger}
"""

${READ_NOTE}

Ask: what would a truly exhaustive audit still be missing? Consider seams NOT yet examined, a whole spec skimmed too fast, a best-practice not checked, an ownership gap where every stream assumes another owns a duty, or a frozen-contract identifier that appears in only some specs. Only return NEW findings not already in the confirmed list, each with the same evidence quality (quotes both sides). Empty array if the audit looks complete. Return via schema.`
}

// ---------------------------------------------------------------------------
// De-dup helper (plain JS — no Date/Math.random in this sandbox)
// ---------------------------------------------------------------------------
function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
function dedupe(findings) {
  const seen = new Map()
  for (const f of findings) {
    if (!f) continue
    const key = norm(f.title) + '::' + norm((f.files || []).slice().sort().join(','))
    const prior = seen.get(key)
    if (!prior) {
      seen.set(key, f)
    } else {
      // keep the more severe / more detailed one
      const rank = { critical: 3, high: 2, medium: 1, low: 0 }
      if ((rank[f.severity] ?? 0) > (rank[prior.severity] ?? 0)) seen.set(key, f)
    }
  }
  return Array.from(seen.values())
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------
phase('Extract ground truth')
log('Reading the real code contracts + seam registry + stability rules into one ledger…')
const gt = await agent(
  `Extract the CURRENT ground truth for the Rentgen SDK into one precise ledger, so downstream auditors compare specs against reality (not against each other's prose).

${SOURCES_BLOCK}

${READ_NOTE}

Produce the ledger described in the schema: exact type fields (with optionality) from types.ts; adapter method signatures from adapters/types.ts; whether events.ts exists and its contents if so; the README seam registry verbatim-ish (events, tags, factory signatures, theming vars, total/currency contract, client API); and the stability-allowlist rules from design spec §10 + best-practices §7. Also list any place the README registry or design spec ALREADY disagrees with the real code (codeVsRegistryDeltas). Quote exact identifiers; do not paraphrase field names.`,
  { schema: GT_SCHEMA, agentType: 'general-purpose', effort: 'high', label: 'ground-truth' }
)

if (!gt || !gt.ledger) {
  log('Ground-truth extraction failed; aborting.')
  return { error: 'ground-truth-extraction-failed' }
}

phase('Check each source')
log(`Fanning out ${STREAMS.length} per-stream checks + README + cross-contradiction + best-practices…`)
const batches = await parallel([
  ...STREAMS.map((s) => () => agent(checkPrompt(s, gt), { schema: FINDINGS_SCHEMA, phase: 'Check each source', effort: 'high', agentType: 'general-purpose', label: `check:ws${s.n}` })),
  () => agent(readmePrompt(gt), { schema: FINDINGS_SCHEMA, phase: 'Check each source', effort: 'high', agentType: 'general-purpose', label: 'check:readme' }),
  () => agent(crossPrompt(gt), { schema: FINDINGS_SCHEMA, phase: 'Check each source', effort: 'high', agentType: 'general-purpose', label: 'cross-contradiction' }),
  () => agent(bestPracticePrompt(gt), { schema: FINDINGS_SCHEMA, phase: 'Check each source', effort: 'high', agentType: 'general-purpose', label: 'best-practices' }),
])

const candidates = dedupe(batches.filter(Boolean).flatMap((b) => (b && b.findings) || []))
log(`${candidates.length} unique candidate findings after de-dup. Adversarially verifying each…`)

if (candidates.length === 0) {
  return { groundTruth: gt, confirmed: [], reconciled: [], falsePositives: [], possiblyMissed: [], summary: 'No candidate findings — specs look internally consistent.' }
}

phase('Verify')
const verified = (
  await parallel(
    candidates.map((f, i) => () =>
      agent(verifyPrompt(f, gt), { schema: VERDICT_SCHEMA, phase: 'Verify', effort: 'high', agentType: 'general-purpose', label: `verify:${f.id || i}` }).then((v) =>
        v ? { ...f, verdict: v.verdict, isReal: v.isReal, severity: v.severity || f.severity, rationale: v.rationale, recommendation: v.recommendation || f.recommendation, owner: v.owner || f.owner } : null
      )
    )
  )
).filter(Boolean)

const confirmed = verified.filter((v) => v.isReal && v.verdict !== 'false-positive')
const reconciled = verified.filter((v) => v.verdict === 'reconciled-elsewhere')
const falsePositives = verified.filter((v) => v.verdict === 'false-positive')

phase('Completeness critic')
log(`${confirmed.length} confirmed. Running the completeness critic…`)
const missed = await agent(criticPrompt(gt, confirmed), { schema: FINDINGS_SCHEMA, effort: 'high', agentType: 'general-purpose', label: 'completeness-critic' })

const rank = { critical: 3, high: 2, medium: 1, low: 0 }
confirmed.sort((a, b) => (rank[b.severity] ?? 0) - (rank[a.severity] ?? 0))

return {
  groundTruth: gt,
  confirmed,
  reconciled,
  falsePositives,
  possiblyMissed: (missed && missed.findings) || [],
  counts: {
    candidates: candidates.length,
    confirmed: confirmed.length,
    reconciled: reconciled.length,
    falsePositives: falsePositives.length,
    possiblyMissed: ((missed && missed.findings) || []).length,
  },
}
