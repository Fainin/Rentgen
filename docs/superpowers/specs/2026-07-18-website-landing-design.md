# Rentgen marketing landing page — design

**Status:** approved, ready for implementation plan
**Owner:** new `apps/website` workspace (not part of the existing 5-workstream split — fully decoupled, no dependency on `@rentgen/sdk`)
**Worktree:** `.claude/worktrees/website-design` (branch `worktree-website-design`)

## Purpose

A standalone marketing/landing page pitching Rentgen, built primarily for hackathon judges (secondary
audience: early public visitors after the event). It is **not** the app itself (`apps/app`) — it sells
the idea and links to/embeds a demo, but the interactive scanner UI stays in `apps/app`.

Core hook: point a phone at your stuff → an agent prices resale + rent/day against live web comps → an
idle-capital total climbs. The landing page dramatizes this with an interactive "x-ray" reveal: a
draggable scan line uncovers hidden value in an illustrated room, with a live €0→€4,200 counter tied to
drag position.

## Visual system

- **Color palette** — "Financial Dashboard" (dark bg + green accent), matching the app's own theme
  intent (`CLAUDE.md`: "dark theme, green accent, idle-capital hero") so the marketing page and product
  read as one brand:
  - Background `#020617`, card surface `#0E1223`, foreground text `#F8FAFC`
  - Accent / money green `#22C55E` — counter, CTAs, x-ray glow, "after" highlights
  - Muted "before" state: `#334155` border, `#94A3B8` muted text — the un-scanned room reads as
    deliberately dull/ordinary, to contrast with the green reveal
  - Destructive red (`#EF4444`) reserved for real error states only, never decorative
- **Typography** — "Tech Startup" pairing: **Space Grotesk** (headings — geometric, faintly technical,
  echoes a scan-line/readout feel without going full sci-fi) + **DM Sans** (body — highly readable for
  longer claims)
- **Tone** — playful through *motion and interaction* (the drag, the climbing counter, item pop-ins),
  not through cartoon type or emoji. Icons are SVG only.
- **Accessibility baseline** — WCAG AA contrast, visible focus rings, 44×44px minimum touch targets,
  `prefers-reduced-motion` respected throughout (see Hero mechanic below).

## Page structure

Six sections, top to bottom, following a before → after narrative that mirrors the x-ray metaphor:

1. **Hero** — full-bleed drag-to-reveal x-ray slider + climbing €0→€4,200 counter + headline + primary
   CTA
2. **The problem** — "Everyone has dead capital lying around" — concrete relatable examples, not an
   invented statistic (see Copy → Honesty note)
3. **How it works** — 3 steps: scan your room → we identify each item → see resale + rent/day, instantly
4. **Trust / privacy** — "Nothing is stored" framing (see Privacy claim decision below)
5. **Built as an SDK** — developer pitch with a real code snippet, framed as giving dead listings a
   second life inside any platform
6. **Final CTA + footer** — repeat CTA, minimal footer (name, SDK/GitHub link)

## Privacy claim decision

The original brief's phrase — "fully discreet, because your video never leaves the server" — conflicts
with the actual architecture: Rentgen is explicitly **client-side, zero-backend** (`CLAUDE.md`). There is
no server; the SDK's adapters call OpenAI Vision and Tavily *directly from the browser*, so frames leave
the device to third-party APIs. A literal "never leaves the server" claim would misstate this and risks
contradiction if judges probe the SDK.

**Resolved framing ("nothing is stored"):** every frame is processed in real time and then discarded —
no server-side storage, no database, no video persisted anywhere. This is accurate to the architecture
and still lands the discretion pitch, without claiming data never reaches a third party.

## Hero mechanic

**Structure** — two stacked illustration layers inside a fixed-aspect hero canvas:
- Base layer ("before"): a muted, desaturated room illustration — ordinary-looking, nothing highlighted
- Reveal layer ("after"): a green x-ray-tinted version of the same room, where each item has a glowing
  outline and a small floating price tag (e.g. "€180")
- A vertical scan-line divider with a drag handle sits on top of both layers

**Interaction model** — dragging (or arrow-keying) the handle updates a single value, `reveal` (0–100%,
clamped — same "never trust the raw number" discipline the app applies to prices). That one value drives,
via CSS `clip-path` on the "after" layer:
- How much of the x-ray layer is exposed, left to right
- Which items have crossed the line and pop in — each item has its own reveal threshold along the 0–100%
  range, so items appear one-by-one as the line moves, not all at once
- The counter value — computed directly from `reveal` (not time-based), so it can never desync from the
  line's actual position

**Counter** — large tabular-figure green number formatted as €0–€4,200. Positioned to the right of the
hero on desktop; on viewports under ~768px it moves above the reveal area instead, since side-by-side
doesn't fit at that width.

**First-load affordance** — on mount, the line auto-sweeps from 0% to ~35% and settles, revealing a
couple of items and some counter movement, so the mechanic is demonstrated without an instruction label.
Under `prefers-reduced-motion`, the auto-sweep is skipped entirely and the hero starts static at 0%.

**Accessibility** — the handle is a real `role="slider"` element (`aria-valuenow`/`aria-valuemin`/
`aria-valuemax`), operable via arrow keys as a non-drag path; touch target ≥44×44px; pointer drag is
throttled to `requestAnimationFrame` to stay within the ~16ms/frame budget; `prefers-reduced-motion`
swaps each item's spring pop-in for a plain fade.

## Copy (headline-level)

| Section | Headline | Supporting line |
|---|---|---|
| Hero | "Your room is worth more than you think." | "Drag the line. Watch dead capital turn into cash." + CTA "Try the scan" |
| Problem | "Everyone has dead capital lying around." | Concrete examples (the unused bike, the old camera, the drawer of cables) instead of an invented stat |
| How it works | "Scan. Identify. Price." | Scan your room → we identify each item → see resale + rent/day, instantly, grounded in live web prices |
| Trust | "Nothing is stored." | Every frame is processed in real time, then it's gone — no server-side storage |
| SDK | "Built as an SDK, not a silo." | Drops into any platform as web components — React, Angular, or plain HTML, unchanged. Give dead listings a second life, right inside your product. Includes a real `configureRentgen()` / `<rentgen-scanner>` code snippet. |
| Final CTA | "Ready to see what your room is hiding?" | Repeat CTA + minimal footer |

**Honesty note:** no invented statistics (e.g. a fabricated "€X billion sits idle" figure) are used
anywhere on the page — same principle applied to the privacy claim above. Claims are either accurate to
the architecture or framed as relatable, non-quantified examples.

## Tech structure

A new sibling workspace, decoupled from the SDK — the landing page does not render a live
`<rentgen-scanner>`/`<rentgen-results>` and has no dependency on `@rentgen/sdk`, so it cannot collide
with any of the five existing workstreams or their frozen contracts:

```
apps/website/
  package.json          @rentgen/website, private, own vite+react+ts deps
  vite.config.ts
  tsconfig.json          extends tsconfig.base.json
  index.html
  src/
    main.tsx, App.tsx
    sections/            Hero.tsx, Problem.tsx, HowItWorks.tsx, Trust.tsx, SdkPitch.tsx, FinalCta.tsx, Footer.tsx
    hero/                XrayReveal.tsx (drag + clip-path + slider a11y), ItemTag.tsx
    styles/               global.css (own CSS custom properties, dark+green theme)
    assets/               hand-authored SVG room/item illustrations
```

Root `package.json` gains two additive scripts, `dev:website` and `build:website` — the existing `dev`/
`build` scripts (bound to `apps/app`) are untouched.

## Error handling & edge cases

- `reveal` is always clamped to `[0, 100]`; the counter is derived from it with the same clamp, so it can
  never show a negative or out-of-range value regardless of input glitches.
- Pointer drag events are throttled to `requestAnimationFrame`, not handled per raw pointermove, to stay
  within frame budget on lower-end devices.
- Keyboard slider is a fully independent, always-available path — dragging is not the only way to
  operate the hero.
- `prefers-reduced-motion` disables the auto-sweep and item spring animations; the hero remains fully
  functional (drag/keyboard still work), just without decorative motion.
- Narrow viewports (<768px): counter relocates above the reveal area rather than beside it; the hero
  illustration keeps a fixed aspect ratio so item positions don't degenerate at extreme widths.

## Testing

No automated test framework, consistent with this repo's stated hackathon scope cut (`CLAUDE.md`:
"No automated tests — deliberate hackathon scope cut"). Verification is manual: smoke-test
`npm run dev:website` in a real browser at desktop and mobile widths, confirm drag + keyboard operation
of the hero, and confirm the reduced-motion path with the OS/browser setting enabled.

## Out of scope (this spec)

- Embedding a live, functional `<rentgen-scanner>` demo on the landing page itself (the CTA links to /
  describes the app; it doesn't run it inline)
- CMS/content editing tooling — copy lives in the section components as static JSX/strings
- Analytics/tracking integration
- Localization (English only)
