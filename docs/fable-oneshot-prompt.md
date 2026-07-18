# Rentgen — Fable 5 one-shot build prompt

> Paste the block below into a fresh Claude Code session **in this repo** (`D:\hackathon\Rentgen`),
> with the session model set to `claude-fable-5` (already the default via `.claude/settings.local.json`)
> and **effort `xhigh`** for the integration/ML-heavy work, dropping to `high`/`medium` for mechanical
> stages. Expect long turns — this is a multi-hour autonomous build. Put your real
> `VITE_OPENAI_API_KEY` / `VITE_TAVILY_API_KEY` in `apps/app/.env` before you start.

---

I'm building **Rentgen** for the {Tech:Europe} × Almedia hackathon — and for the fainin team, who
will consume the SDK from Angular. Point a phone at your stuff *while filming*; item cards with
resale + rent/day appear; an idle-capital total climbs; it closes on *"You're sitting on €4,200 doing
nothing."* The whole portability bet is standard web components: the SDK must drop into React, Angular,
or plain HTML unchanged. I want you to implement the whole product end to end in this run. Most important, you need to be done till 19:00 so good 3 hours from now!

**Source of truth — read first, build against exactly:** `CLAUDE.md`;
`docs/specs/2026-07-18-rentgen-sdk-design.md`; `docs/specs/workstreams/README.md` and all five stream
specs; the frozen contracts in `packages/sdk/src/types.ts` and `packages/sdk/src/adapters/types.ts`;
and `docs/mockup/result-list-mockup.png` for the result screen. `.claude/rules/fable.md` and
`.claude/rules/agent-efficiency.md` already define how you work and how to spawn subagents in this
repo — follow them; I'm not repeating them here.

**Reuse a working prototype — port logic, not transport.** A prior prototype of this exact product
lives at `D:\hackathon\krempel` (built with Gemini + a Hono/Vercel backend). Read
`D:\hackathon\krempel\docs\GEMINI-CONTEXT.md` first, then mine its source for proven logic. **Critical
difference:** new Rentgen is **client-side, zero-backend, OpenAI** — the prototype's server/Vercel
transport does **not** carry over. Lift the *logic* into our adapter seams and let it call APIs from the
browser. Reuse map:

- `server/vision.ts` (LLM vision + strict-JSON parse — already noted to move Gemini→OpenAI
  `/v1/chat/completions`, `image_url` parts, `response_format: json_schema strict`) → **Stream 2**
  `detection/openai-vision.ts`.
- `server/sellprice.ts` (Tavily web search for real used prices) → **Stream 3** `enrichment/tavily-comps.ts`.
- `server/pricing.ts` (`sanitizePrices` deterministic clamp, `totalValueEUR`) → **Stream 3** validation
  (finite guard, value cap, rent band) + **Stream 4** total math.
- `web/src/capture.ts` (camera capture) → **Stream 1** `capture/rentgen-scanner.ts`.
- `web/src/{motion,share}.ts` (confetti/sound, share card) → **Stream 4/5** polish (the "wow" moment).
- `server/memory.ts` (Cognee inventory memory) → **Phase 3** persistence.
- `shared/types.ts` (`Draft`, `KrempelAdapter`) → **reference only**; our frozen `types.ts` wins — do
  not import or copy its shapes.

Carry these prototype gotchas straight into `docs/build-notes.md` and respect them from the start:
camera needs **HTTPS or localhost** (`NotAllowedError` in in-app browsers → test on phone via real
browser + HTTPS/QR); **LLM output is untrusted** (strict schema, confidence filter, cap strings/strip
`<>`, cap item count); **clamp prices deterministically** (`Number.isFinite` guard, value cap, rent
1–8% of value — the model emits NaN/Infinity/absurd); **`AbortSignal.timeout` on every external call**;
**secret-scan before any public push**.

**Scope — all five workstreams, phase-gated.** Honor the phase firewall as a hard rule:

1. **Phase 1** — tap-to-capture → `getClient().scan(image)` → detect → enrich (parallel) → idle-capital
   total → `<rentgen-results>` cards. Must demo end-to-end (stub *and* real) before you touch Phase 2.
2. **Phase 2** — live camera pan: in-browser detector + tracker + best-in-frame crop, one scan per
   physical object, no double-counting. Must be solid before Phase 3.
3. **Phase 3** — upsell: export bundle from the *selected* items, `<rentgen-upsell>` action bar,
   `<rentgen-report-card>`. Turning it off must leave the Phase-1 demo untouched.

The frozen seam registry is law. Never change a covered contract (`types.ts`, `adapters/types.ts`,
`events.ts`, custom-element tags, CSS vars) as a side effect. The two registry edits the specs already
sanctioned (`EnrichedItem.image?`, `selection:change`, `rentgen-report-card`, the `asset` config
pass-through) are Stream-4 stewardship calls — make them deliberately and sync the README registry. Any
*other* contract change: stop and ask me first.

**Execution — seam first, then fan out.** Act as Stream 4 (the integration hub) yourself first: publish
the seam with stubs — `events.ts`, `config.ts` (`configureRentgen`/`getClient`) returning a stub-backed
client, `storage/`, the `index.ts` barrel, and the `RentgenClient` skeleton — so nothing downstream is
blocked. Then dispatch **one parallel subagent per remaining workstream** (1 capture, 2 detection,
3 enrichment, 5 upsell); each owns only its disjoint folder, builds its stub first, then the real
module behind the same interface. Keep building Stream 4's results UI + `apps/app` wiring while they
run; integrate each real module as it lands; intervene only if a subagent drifts or crosses a seam.
After each real module lands, run a **fresh-context verifier subagent** to check it against that spec's
Definition of Done — separate verifier context beats self-review. Set every subagent's `model`
explicitly per `agent-efficiency.md`.

**Keys & the Tavily CORS risk.** Real OpenAI + Tavily keys are in `apps/app/.env`. The app passes them
into `configureRentgen`; the SDK never reads `import.meta.env`. Run the Tavily browser-CORS smoke test
*before* any enrichment polish — if direct browser calls are blocked, swap only the transport inside
`enrichment/tavily-comps.ts`; the interface stays put. Verify real vision + real grounded pricing on a
real image before you call Phase 1 done.

**Portability deliverables.** `apps/app` (React/Vite) is the runnable demo. Also add a plain-HTML page
that mounts `<rentgen-scanner>`/`<rentgen-results>` from the built SDK (proves zero-framework use), and a
documented Angular integration snippet (`CUSTOM_ELEMENTS_SCHEMA`) in `packages/sdk/README.md`. No second
full app.

**Definition of done.** `npm run typecheck` and `npm run build` both green; `npm run dev` boots the
assembled app; the demo runs end-to-end against stubs offline **and** real keys online; a rehearsal
re-scan is instant (cache hit); a slow live pan triggers exactly one scan per object with the total
climbing and no duplicates; per-item selection + "List N" exports a bundle of only the selected subset;
the result screen matches the mockup's intent (dark theme, green accent, idle-capital hero, per-item
cards with sources + confidence chip + photo, bottom action bar). There are no automated tests by
design — smoke-test by actually driving the app in a browser and report what you saw. Before reporting
progress, check each claim against a real tool result; if a step failed or was skipped, say so.

**Memory.** Keep a running `docs/build-notes.md` — one lesson per entry with a one-line summary:
decisions made, gotchas hit (Tavily CORS outcome, detector/bundler issues, anything a teammate needs).
Update entries instead of duplicating; delete ones that prove wrong.

**Autonomy.** You're running largely unattended. For reversible actions that follow from this brief,
proceed without asking. Pause and end the turn only for something genuinely mine to decide — a real
scope change, a destructive/irreversible action, or input only I can provide (a missing key, or a
CORS fallback that needs a host I must stand up). Don't end a turn on a plan or a promise: if your last
paragraph is "I'll now…", do it with tool calls instead. When you do stop, lead with what's built and
verified, then the one or two things you need from me.

Confirm the `.env` keys are present and give me your seam-publish plan in one or two lines, then build.
