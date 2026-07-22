# Rentgen — Final 2-min Loom Script (jury submission)

> Submission requirement ({Tech: Europe} × Almedia): **explain the solution + live walkthrough
> of the key features.** Hard limit **2:00**. Record → submit via the form **before 19:00**.
> Every claim below matches the shipped build (see README STATUS) — don't ad-lib features.

## The script

**0:00–0:15 — The Secret** `[black screen → Rentgen logo (docs/brand/)]`

> "Amazon knows every product on its shelves. Nobody knows the products on yours.
> The world's largest warehouse is scattered across living rooms — invisible.
> Rentgen makes it visible. X-ray your room. See what it's worth."

**0:15–0:45 — Live scan** `[screen: phone browser, real room with hero items]`

> "This is Rentgen, running live in the browser — no app install, no backend.
> I point my phone at my stuff. Tap to capture — or just pan across the room.
> It recognizes each object as I go: the camera, the speaker, the monitor."

**0:45–1:15 — Grounded prices + the reveal** `[results list → CLICK one source link → total counter]`

> "Here's the part an AI can't fake: every price is grounded in live web comparables.
> Real listings, real links — this is where the number comes from.
> For each item: resale value, and rent per day.
> And the total keeps climbing: **€X,XXX** — idle capital, sitting in this one room."

**1:15–1:35 — Select & export** `[select items → export the listing bundle]`

> "I pick what I want to monetize and export ready-to-post listings —
> titles, descriptions, prices, photos. One bundle, any marketplace."

**1:35–1:52 — The tech** `[15s: architecture diagram or adapter code]`

> "Under the hood: OpenAI vision with strict structured outputs identifies the objects.
> Tavily grounds every price in live market data.
> And the whole value chain is an SDK — client-side, zero backend, two embeddable widgets."

**1:52–2:00 — Close** `[logo]`

> "Rentgen isn't another marketplace — it's the X-ray any marketplace can embed.
> Every home becomes a warehouse. Rentgen. See what your stuff is worth."

## Before recording (gates)

- [ ] **Numbers gate:** do one real trial run; replace €X,XXX with the actual total from that run. Never a fabricated number.
- [ ] Stage 3–4 hero items with strong prices (camera / speaker / monitor — things Tavily prices well).
- [ ] Phone camera needs HTTPS → record against the deployed URL, not localhost.
- [ ] Pre-record one clean fallback run. If live Wi-Fi dies mid-recording: `?stub=1` runs the full flow offline — say "this is the offline demo mode, same code path".
- [ ] The source-link click at 0:45 is the credibility moment — don't cut it.
- [ ] 2:00 is a hard Loom limit. Rehearse once with a timer; cut from the tech section first, never from the demo.

## Fallback lines

- Scan takes a beat: *"This wait is the entire effort — after it, there's no form to fill."*
- Price looks off on one item: *"Grounded means honest — you can click every source and judge it yourself."*

## Why this structure (for whoever records)

Hook = the market secret, not the product. The demo carries explanation duty (requirement: "explain + walkthrough" — we do both at once by narrating the demo). Partner tech is named exactly where the jury gate needs it (OpenAI, Tavily), claimed only as deep as we built it — Cognee is an adapter interface, not a shipped feature, so it stays out of the video and lives in the README as architecture.
