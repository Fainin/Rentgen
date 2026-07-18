# Idle Capital — Hackathon Design & Runbook

**Event:** {Tech: Europe} × Almedia Hackathon — "The Summer Lock-In", Berlin (1 day)
**Team:** 3–4 · **Stack:** Node + mobile web · **Credits:** OpenAI (+ partner APIs)
**Date drafted:** 2026-07-16

> One-liner: **Point your phone at your stuff; an agent identifies each item, prices its resale + rent-per-day value against live web comps, and an "idle capital" total adds up.** Ends on a shareable *"You're sitting on €4,200 doing nothing"* moment.

**Guiding principle: proof of concept first.** Build the dumbest thing that proves the value, get it working end-to-end, *then* make it live and fancy. Each phase below is independently demo-able — if you only finish Phase 1, you still have a real demo.

---

## 1. Why this wins the room

Judges/partners reward: an **agentic** build using **OpenAI + ≥1–2 partner tools**, a **60-second visual demo**, and a **VC-legible use case**. Idle Capital hits all four — and "unlock idle assets" is the entire sharing-economy thesis made visceral. XAnge (the VC in the room) gets it instantly; every attendee is literally sitting on scannable stuff. Loose fainin/OSS payoff (§7) is a bonus, not the point.

## 2. The demo we're building toward

1. Point the phone at the demo table / a teammate's backpack.
2. Item cards appear with € values (resale + rent/day), each showing its web sources.
3. An **idle-capital total** adds up → *"€4,200 idle. Earning €0. Rent these 5 things → €380/month."*
4. Closing line: *"Every room in this building is a marketplace that hasn't happened yet."* 🎤

**Rehearse this on real venue objects. Record a clean fallback video in case wifi dies.**

---

## 3. Build order (this is the whole plan)

### Phase 1 — PoC: the value chain, simplest possible (morning)
**Goal: tap → priced items → total, working end-to-end. No live detection, no tracker, no memory.**

```
 phone camera → [tap to capture ONE photo]
        │  single image
        ▼
 POST /scan  (backend, one request):
     1. OpenAI vision: "list the distinct sellable/rentable objects in this photo,
                        each with name, category, condition, confidence"
     2. for each object → Tavily: fetch resale/rental comps (with source links)
     3. OpenAI: reconcile comps → { resale range, rentPerDay range, confidence }
        ▼
 frontend: render item cards + running total
```

That's the entire PoC. **One screen, one button, one backend endpoint.** If this is smooth, you already have a winning demo. Everything else is polish.

- Keep it to **OpenAI + Tavily** only. Two partner tools is enough to score.
- Cache `/scan` results by a simple image hash so re-runs (and the rehearsal) are instant and free.

### Phase 2 — Make it live (afternoon, only if Phase 1 is solid)
Replace "tap to capture" with a **live pan** so the total climbs as you move the camera. This is where Kevin's gating idea comes in — and it exists purely to avoid calling vision on every frame:

- **Local detector in-browser** (TF.js COCO-SSD or transformers.js YOLO) draws boxes at a few fps → the "live" feel, for free.
- **Track** each box across frames (simple centroid/IoU tracker) → stable `trackId` per physical object.
- **Gate:** only a *new* track that's been stable for ≥ N frames triggers a price call. Existing tracks are ignored → no double-counting, no cost blowup.
- **Best-in-frame crop** (Kevin's refinement): buffer a new object over ~1s, send the frame where it's **largest + most centered + sharpest** (`area + centeredness + sharpness + detector-confidence`). One call per object, best possible crop.
- Reuse the **same `/scan` logic** from Phase 1 — now called per newly-detected object instead of per photo.

### Phase 3 — Make it a product (stretch, only if time)
- **cognee** persistent portfolio: remembers scans across sessions → *"welcome back, your idle capital is now €5,100"* (this is the third partner tool).
- Shareable report card + QR · monthly-earnings projection · one-tap "list top 3 for rent" (QR → fainin) · CO₂/sustainability line.

## 4. Partner-tool mapping

| Tool | Phase | Role |
|---|---|---|
| **OpenAI** | 1 | Vision identify + reconcile comps into a defensible number |
| **Tavily** | 1 | Live resale/rental comps with source links → price is **grounded, not hallucinated** |
| **cognee** | 3 | Persistent asset portfolio across sessions (turns the toy into a product) |

## 5. Stack & the one API contract

- **Frontend:** mobile-first web, **Vite + React** (build speed). Phase 1 = camera + capture button + result list. Phase 2 adds a `<canvas>` overlay + local detector.
- **Backend:** **Node + Fastify**, one main endpoint:

```
POST /scan  { imageBase64 }
  → { items: [ { name, category, condition, confidence,
                 resale:{min,max,currency}, rentPerDay:{min,max},
                 sources:[{title,url}] } ],
      totalIdleValue }
```

Phase 2 calls `/scan` with a single-object crop; Phase 1 calls it with a full photo. Same endpoint.

## 6. Team split & timeline (8h)

**Split (parallel from hour 1, against a stubbed `/scan`):**
1. **Frontend** — camera + capture + result cards + total. (Phase 2: overlay + detector.)
2. **Vision** — OpenAI multi-object identify from a photo.
3. **Pricing** — Tavily comps → OpenAI reconcile → grounded price + cache.
4. **Glue/polish** — total logic, report card, demo prep. *(Merge into 2/3 if only 3 people.)*

**Timeline:**
- **10:00–11:00** Scaffold; wire OpenAI + Tavily keys; agree the `/scan` contract (§5); stub it so everyone unblocks.
- **11:00–14:00** Phase 1 in parallel against the stub.
- **14:00–15:30** Integrate real APIs → first end-to-end: photo → priced items → total.
- **15:30–18:00** *If Phase 1 solid:* Phase 2 live pan. Otherwise polish Phase 1 hard.
- **18:00–19:00** Freeze. Rehearse the §2 run 5×. Record fallback video. Prep the 2-line pitch.

## 7. Risks & fainin/OSS payoff

| Risk | Mitigation |
|---|---|
| Vision latency/cost | Phase 1 is one call per photo; Phase 2 prices only *new* objects + hash cache |
| Price hallucination | Tavily grounding + always show sources + a confidence chip |
| Demo-day flakiness | Pre-test on venue objects; **recorded fallback**; warm the cache on demo items |
| Scope creep | Phases are a firewall — don't start Phase 2 until Phase 1 demos cleanly |

**Payoff (bonus):** the Phase-1 `/scan` core is a reusable open-source **`price-from-photo` Node module** (OpenAI vision + Tavily comp reconciliation) — exactly the engine behind fainin's existing `plugin-open-ai` price recommendation.

---

*Design produced via the brainstorming skill. Resolved forks: hero framing = Idle-Asset Scanner; approach = local-detect + smart-price (Phase 2), sequenced PoC-first per Kevin.*
