# Rentgen — SDK-First Design & Runbook

**Event:** {Tech: Europe} × Almedia Hackathon — "The Summer Lock-In", Berlin (1 day)
**Team:** 3–4 · **Stack:** TypeScript, npm workspaces, Lit, React (Vite) · **Credits:** OpenAI (+ partner APIs)
**Repo:** [github.com/Fainin/Rentgen](https://github.com/Fainin/Rentgen) — local clone at `D:\hackathon\Rentgen`
**Date drafted:** 2026-07-18
**Supersedes/extends:** `2026-07-16-idle-capital-hackathon-design.md` (same product idea, demo script, and phased build order — this doc replaces its §3/§5 architecture with an SDK-first, client-side-only design and formalizes the product name)

> One-liner: **Point your phone at your stuff; an agent identifies each item, prices its resale + rent-per-day value against live web comps, and an "idle capital" total adds up.** Ends on a shareable *"You're sitting on €4,200 doing nothing"* moment.

**Name:** Rentgen — reads as German *Röntgen* (X-ray: "sees through your stuff to what's inside") and as "rent-gen" (rent + generate value). Instantly gettable in a 60-second demo without explanation.

**Guiding principle: proof of concept first.** Build the dumbest thing that proves the value, get it working end-to-end, *then* make it live and fancy. Each phase is independently demo-able.

**SDK-first principle:** the core value chain (detect → enrich → price → total) ships as a reusable, framework-agnostic package, not baked into one app. A separate, thin app *launches* it. Anyone should be able to drop `<rentgen-scanner>` + `<rentgen-results>` into a React, Angular, or plain HTML page and get the same behavior.

---

## 1. Why this wins the room

Judges/partners reward: an **agentic** build using **OpenAI + ≥1 partner tool**, a **60-second visual demo**, and a **VC-legible use case**. Idle Capital hits all four — "unlock idle assets" is the entire sharing-economy thesis made visceral. XAnge (the VC in the room) gets it instantly; every attendee is literally sitting on scannable stuff. Loose fainin/OSS payoff (§8) is a bonus, not the point. Shipping it as an embeddable SDK is itself a small demo-day flex: "this isn't a one-off demo, it's a component any product can install."

## 2. The demo we're building toward

1. Point the phone at the demo table / a teammate's backpack.
2. Item cards appear with € values (resale + rent/day), each showing its web sources.
3. An **idle-capital total** adds up → *"€4,200 idle. Earning €0. Rent these 5 things → €380/month."*
4. Closing line: *"Every room in this building is a marketplace that hasn't happened yet."* 🎤

**Rehearse this on real venue objects. Record a clean fallback video in case wifi dies.**

---

## 3. Architecture — two packages, npm workspaces, zero backend

```
Rentgen/
  package.json                 workspaces: ["packages/*", "apps/*"]
  packages/sdk/                @rentgen/sdk — everything reusable, all client-side
    src/
      adapters/
        types.ts               DetectionAdapter / EnrichmentAdapter / AssetAdapter interfaces
        openai-vision.ts        DetectionAdapter: browser fetch → OpenAI vision → objects
        tavily-comps.ts          EnrichmentAdapter: browser fetch → Tavily comps → Gemini reconcile → priced item + sources
      client/RentgenClient.ts   orchestrates detect → enrich (parallel) → persist → return
      storage/sessionStore.ts  localStorage wrapper: session state + image-hash cache (dedup rehearsal runs)
      widgets/
        rentgen-scanner.ts     Lit element: capture button/video, calls RentgenClient.scan()
        rentgen-results.ts     Lit element: item cards + running total
      index.ts                 public exports: widgets (self-register), RentgenClient, adapter interfaces, types
  apps/app/                    plain React (Vite) app — "the base app that uses and launches it"
    src/App.tsx                 mounts <rentgen-scanner>/<rentgen-results>, idle-capital headline/layout
    .env.example                VITE_OPENAI_API_KEY / VITE_GEMINI_API_KEY / VITE_TAVILY_API_KEY (demo-scoped, rotated post-event)
```

**No backend.** Adapters call OpenAI, Gemini, and Tavily directly from the browser using build-time-embedded keys (`import.meta.env.VITE_*` via Vite). This is a deliberate, explicitly approved trade-off for a one-day hackathon demo: keys are demo-scoped/rate-limited and rotated after the event. If this constraint changes later (a shipped product, not a demo), the fix is to move `adapters/*` behind a thin server and keep everything else — widgets, `RentgenClient`'s public API, `apps/app` — unchanged, since the adapter interfaces don't encode *where* they run.

**Why this split:** the adapter pattern is the SDK's plugin surface — anything OpenAI/Tavily/cognee-shaped plugs in by implementing an interface and registering it in `RentgenClient`, without touching the widgets or the app. The widgets are the distribution mechanism — standard Custom Elements consumable from React (native passthrough in React 19+), Angular (`CUSTOM_ELEMENTS_SCHEMA`), or plain HTML, styled purely via CSS custom properties (`--rentgen-accent`, `--rentgen-card-bg`, `--rentgen-radius`, …) so host apps theme without touching internals.

## 4. Three adapter types (the plugin surface)

1. **`DetectionAdapter`** — `detect(imageBase64) → DetectedObject[]`. Default: `openai-vision`.
2. **`EnrichmentAdapter`** — `enrich(object) → EnrichedItem` (price range + rent/day + sources). Default: `tavily-comps` (Tavily search → Gemini Flash reconcile).
3. **`AssetAdapter`** *(optional, stretch, §7 Phase 3)* — `render(session) → Asset` (e.g. a shareable report-card image). Empty by default.

Adding a new enrichment source during the hackathon (swap Tavily, add cognee) is "write an adapter implementing the interface, register it in `RentgenClient`" — no widget or app changes.

## 5. Data flow

1. `<rentgen-scanner>` captures a photo → `RentgenClient.scan(imageBase64)` → checks the localStorage image-hash cache (instant on rehearsal repeats) → else runs the `DetectionAdapter` → runs the `EnrichmentAdapter` per object (parallel) → writes the session to localStorage → returns `{ items, totalIdleValue }`.
2. `<rentgen-results>` renders from the scan result, or calls `RentgenClient.consume(sessionId)` to redisplay an existing session's compiled items, total, sources, and any assets — without re-scanning. This is the SDK-level realization of "give me the final product data and assets": a read method backed by local storage instead of an HTTP endpoint, since there's no server.
3. Phase 2 (live pan + cloud detector/tracker) and Phase 3 (`AssetAdapter` report card, cognee persistence) both slot into `@rentgen/sdk` later without changing `apps/app`.

## 6. Build order (this is the whole plan)

### Phase 1 — PoC: the value chain, simplest possible (morning)
**Goal: tap → priced items → total, working end-to-end. No live detection, no tracker, no memory.**

```
phone camera → [tap to capture ONE photo]
       │ single image
       ▼
RentgenClient.scan(imageBase64):
    1. DetectionAdapter (openai-vision): "list the distinct sellable/rentable objects in this photo,
                       each with name, category, condition, confidence"
    2. for each object → EnrichmentAdapter (tavily-comps): fetch resale/rental comps (with source links),
                       reconcile via Gemini → { resale range, rentPerDay range, confidence }
       ▼
<rentgen-results>: render item cards + running total
```

That's the entire PoC — one screen, one button, two widgets, one SDK call. If this is smooth, you already have a winning demo. Everything else is polish.

- Keep it to **OpenAI + Tavily** only. Two partner tools is enough to score.
- Cache `scan()` results by a simple image hash in localStorage so re-runs (and the rehearsal) are instant and free.

### Phase 2 — Make it live (afternoon, only if Phase 1 is solid)
Replace "tap to capture" with a **live pan** so the total climbs as you move the camera:

- **Cloud detector** (`gemini-flash-latest`, browser fetch, `x-goog-api-key`) samples one frame
  every ~250 ms → identified objects (name/category/confidence + optional region). **No on-device
  model bundle, no bounding-box overlay** — boxes glitch at low fps and read as fake AR; items
  surface as cards in the results list, not on the feed.
- **Identity-track** each object across frames by `name`+`category` (dHash fallback) → one scan
  per physical object, no double-counting, no cost blowup.
- **Gate:** only a *newly confirmed* identity (seen in ≥ N consecutive frames) triggers
  `RentgenClient.scan()`. Existing identities are ignored.
- **Best-frame crop:** buffer a new object ~0.5 s, send the frame where it's **largest + most
  centered + sharpest** (`area + centeredness + sharpness`). One call per object, best crop.
- Same `RentgenClient.scan()` call as Phase 1 — now invoked with a single-object crop instead of a full photo.

### Phase 3 — Make it a product (stretch, only if time)
- **cognee** persistent portfolio via a new `EnrichmentAdapter`/session-hydration step: remembers scans across sessions → *"welcome back, your idle capital is now €5,100"* (third partner tool).
- **`AssetAdapter`**: shareable report card + QR · monthly-earnings projection · one-tap "list top 3 for rent" (QR → fainin) · CO₂/sustainability line.

## 7. Partner-tool mapping

| Tool | Phase | Role |
|---|---|---|
| **OpenAI** | 1 | Vision identify (`gpt-5.6-luna`) — the hero detection. Pflicht-Partner + main prize credits. |
| **Tavily** | 1 | Live resale/rental comps with source links → price is **grounded, not hallucinated** |
| **cognee** | 3 | Persistent asset portfolio across sessions (turns the toy into a product) |

> **Implementation note (not a partner):** the **live-pan detector** and the **price reconcile**
> both run on `gemini-flash-latest` (Google AI Studio, free tier) — preserves OpenAI credits for
> the hero detection and ships no model bundle to the browser. Tavily grounds prices; Cognee is
> Phase 3. A **sellability gate** in `RentgenClient` drops non-sellable / ungrounded / sub-€5
> items before they reach the list, so the idle-capital total is honest by construction.

## 8. Team split & timeline (8h)

**Split (parallel from hour 1, against a stubbed `RentgenClient`):**
1. **App/UI** — `apps/app` camera + capture + result cards + total layout. (Phase 2: frame-sampler wiring, no overlay.)
2. **Vision adapter** — `openai-vision.ts` multi-object identify from a photo.
3. **Pricing adapter** — `tavily-comps.ts` comps → Gemini reconcile → grounded price + localStorage cache.
4. **Glue/polish** — total logic, report card, demo prep. *(Merge into 2/3 if only 3 people.)*

**Timeline:**
- **10:00–11:00** Scaffold monorepo; wire OpenAI + Gemini + Tavily keys into `.env`; agree `RentgenClient`/adapter interfaces (§4); stub adapters so everyone unblocks. **Smoke-test Tavily's browser CORS behavior now** — see §9 risk.
- **11:00–14:00** Phase 1 in parallel against the stub.
- **14:00–15:30** Integrate real adapters → first end-to-end: photo → priced items → total.
- **15:30–18:00** *If Phase 1 solid:* Phase 2 live pan. Otherwise polish Phase 1 hard.
- **18:00–19:00** Freeze. Rehearse the §2 run 5×. Record fallback video. Prep the 2-line pitch.

## 9. Risks & explicit scope cuts

| Risk | Mitigation |
|---|---|
| **Tavily may not support direct browser CORS calls** | Test in hour 1, not demo day. Fallback: swap only `tavily-comps.ts`'s transport (e.g. a CORS-safe hosted path) — no other architecture change needed, since the adapter interface doesn't leak transport details. |
| **API keys visible in the browser bundle** | Accepted trade-off for a one-day demo build — demo-scoped/rate-limited keys, rotated after the event. Not a shipped-product posture. |
| Vision latency/cost | Phase 1 is one call per photo; Phase 2 prices only *new* objects + image-hash cache |
| Price hallucination | Tavily grounding + always show sources + a confidence chip |
| Demo-day flakiness | Pre-test on venue objects; **recorded fallback**; warm the cache on demo items |
| Scope creep | Phases are a firewall — don't start Phase 2 until Phase 1 demos cleanly |
| No automated tests | Manual smoke test against real venue objects only — explicit, deliberate scope cut for the hackathon clock, not a silent omission |

**Payoff (bonus):** `@rentgen/sdk`'s adapter pattern is directly reusable — it's the same shape as fainin's existing `plugin-open-ai` price recommendation engine, and the whole SDK is portable into any web product (React, Angular, plain HTML) as a drop-in component pair.

## 10. Stability contract — the frozen allowlist

The 5-workstream split (§8, and `specs/workstreams/`) only works if everyone builds against a surface that *doesn't move under them*. We adopt an **explicit stability allowlist** (the k6/OpenZeppelin model): only the symbols named here carry a stability guarantee — everything else (internal workstream modules, private helpers, experimental code) is free to change without ceremony.

**Covered surface (change only by team agreement, never casually):**
- `packages/sdk/src/types.ts` — `DetectedObject`, `EnrichedItem`, `ScanResult`, and the shared data shapes handed off between streams.
- `packages/sdk/src/adapters/types.ts` — the `DetectionAdapter` / `EnrichmentAdapter` / `AssetAdapter` interfaces.
- The `create*Adapter()` factory signatures — `createDetectionAdapter` / `createEnrichmentAdapter` / `createAssetAdapter`, each exported from its owning stream's folder barrel (not from `adapters/types.ts`).
- `events.ts` — the shared event bus names (`scan:*` plus `selection:change`) and the self-registering custom-element tags (`<rentgen-scanner>` / `<rentgen-results>` / `<rentgen-upsell>` / `<rentgen-report-card>`).
- The CSS custom-property theming vars (`--rentgen-accent`, `--rentgen-card-bg`, `--rentgen-radius`, `--rentgen-font`).

**Rules:** breaking a covered symbol is a **major** change — pause, name the owning workstream, agree before diverging (this is the CLAUDE.md scope-discipline rule made concrete). We version `0.x` for the event: minor bumps *may* break pre-1.0, but a covered-symbol break is still an explicit, announced decision, not a merge surprise. Swapping an adapter's *transport* (e.g. the Tavily CORS fallback, §9) is **non-breaking** — the interface is the covered symbol; where the call runs is not.

**Rationale & full best-practices background:** see [`../sdk-best-practices.md`](../sdk-best-practices.md) — a verified research digest behind these choices (ports & adapters, configure-once, deep-merge defaults, Lit + `@lit/react`, SemVer allowlist), plus anti-patterns to avoid and open items (notably **runtime validation at the adapter seams** — candidate Zod schemas on `DetectedObject`/`EnrichedItem`, which touches the frozen `types.ts` and needs team sign-off).

---

*Design produced via the brainstorming skill, 2026-07-18. Pivoted from the original phase-based Idle Capital design to an SDK-first, two-package (`@rentgen/sdk` + `apps/app`), fully client-side architecture per Kevin's direction: one simple monorepo, SDK path + a React app that launches it, no backend where avoidable.*
