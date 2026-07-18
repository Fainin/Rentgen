# SDK Design & Documentation — Best Practices for Rentgen

> Distilled from a multi-source, adversarially-verified research pass (2026-07-18): 22 sources fetched, 105 claims extracted, 25 fact-checked with 3-vote verification (a claim needed ≥2/3 to survive). This file captures **what survived** and **what got killed**, framed as guidance for `@rentgen/sdk`. The authoritative design lives in [`specs/2026-07-18-rentgen-sdk-design.md`](specs/2026-07-18-rentgen-sdk-design.md); this is the *rationale layer* behind its architecture choices.

**Confidence legend:** 🟢 high (primary vendor/spec source, 3-0 vote) · 🟡 medium (canonical principle, blog-sourced or with a caveat).

---

## 1. Adapter surface = Ports & Adapters 🟢

Model the plugin surface as hexagonal **ports and adapters**: a technology-agnostic interface (the *port*) is owned by the core; a concrete implementation (the *adapter*) plugs real tech in. Multiple adapters satisfy one port and are swapped via dependency injection.

**In Rentgen:** `RentgenClient.scan()` orchestrates against the `DetectionAdapter` / `EnrichmentAdapter` / `AssetAdapter` interfaces only — never against concrete OpenAI/Tavily calls. `openai-vision` / `tavily-comps` are production adapters; `stub.ts` satisfies the same interface for the offline demo. This is the canonical Cockburn hexagonal / SOLID Dependency-Inversion pattern.

> **Naming note (harmless):** in strict hexagonal terms, our interfaces *named* `…Adapter` actually play the role of **ports**; the concrete impls are the adapters. The inversion doesn't affect validity — just don't get tangled if someone cites "ports & adapters" in review.

**Rule:** the core depends on abstractions. If `RentgenClient` ever imports from `openai-vision.ts` directly, that's a violation.

Source: [Hexagonal Architecture guide](https://generalistprogrammer.com/tutorials/hexagonal-architecture-complete-guide), `packages/sdk/src/adapters/types.ts`.

## 2. Expose plugins through a factory that returns the interface 🟡

Consumers should depend on the interface, never the concrete class. `createDetectionAdapter() → DetectionAdapter` is exactly right — it's what gives us Open/Closed extensibility: *add a data source without touching widgets or the app.*

**Two corrections the verifier caught — don't over-engineer:**
- A *generic-constrained* `registerPlugin<T extends Plugin>()` adds **no** compile-time safety over a plain `registerPlugin(p: Plugin)`. The type annotation does the enforcing; the generic only preserves inference. Keep registration signatures plain.
- Compile-time enforcement only covers **first-party, statically-typed** adapters. Anything dynamically loaded would need runtime validation (TS types erase). Not a concern for our in-repo adapters — but see [§8 open item](#8-open-items-worth-a-decision).

Our adapters are **stateless capability interfaces** (`detect` / `enrich`) with no `initialize()`/`destroy()` lifecycle. That's a legitimately simpler and valid shape — not a gap.

Sources: [Plugin architecture](https://code.lol/post/programming/plugin-architecture/), [TS plugin systems](https://dev.to/hexshift/designing-a-plugin-system-in-typescript-for-modular-web-applications-4db5).

## 3. Configure once, Sentry-style 🟢

A single `configureRentgen(options)` call that sets all configuration at init is the proven model (verified against Sentry's `init()`). All config flows through one options object; only runtime scope mutations (if any) get separate calls.

Source: [Sentry JS SDK options](https://docs.sentry.io/platforms/javascript/configuration/options/).

## 4. Deep-merge overrides onto sensible defaults 🟢

Merge strategy: **deep-merge objects, replace arrays wholesale, replace class instances wholesale, keep it strongly typed.** A user overriding one nested field keeps sibling defaults; passing an adapter *replaces* the default adapter entirely (correct — you never want to merge two adapters into one).

> **Refuted (0-3):** the claim that a *dedicated* deep-merge library beats `Object.assign` / destructuring / lodash `_.merge` for typing did **not** survive. Pick the merge tool on its merits — don't add a dependency assuming a typing advantage that isn't there.

Source: [options-defaults](https://github.com/radarsu/options-defaults).

## 5. Framework-agnostic Lit core + thin React shell 🟢

Separate **portable primitives** (our Lit widgets) from **app-level reactive wrappers** (the React/Vite shell). The sanctioned thin React layer is `@lit/react`'s `createComponent()` / `useController()` — it sets props as element **properties** (not just attributes) and maps named events to `addEventListener` via the `events` option, so `<rentgen-scanner>` is consumed idiomatically in React.

> **Build-time check:** use `@lit/react` (it supersedes `@lit-labs/react`). This is the one time-sensitive item in the research — verify the package name when wiring the app shell.

> **Refuted (0-3):** "web components are *the best* foundation, avoiding framework lock-in." The *separation-of-concerns* pattern is endorsed; the blanket "web components are universally best" claim is contested. We use web components because they fit our multi-framework distribution goal — not because they're categorically superior.

Sources: [Lit + React](https://lit.dev/docs/frameworks/react/), [Framework-agnostic design systems](https://piccalil.li/blog/framework-agnostic-design-systems-part-1/).

## 6. Theme only via inheriting CSS custom properties 🟢

Verified verbatim against Lit docs: *"All CSS custom properties inherit. You can use this to make your component's styles configurable from outside."* Our `--rentgen-accent` / `--rentgen-card-bg` / `--rentgen-radius` / `--rentgen-font` approach — and the rule forbidding reaching into widget internals — is exactly Lit's recommended per-instance theming mechanism.

Source: [Lit styles](https://lit.dev/docs/components/styles/).

## 7. SemVer + an explicit stability allowlist 🟢

**Most relevant to our 5-parallel-workstream, build-against-frozen-contracts model.** Three converging rules:

1. **Enumerate exactly which symbols are stable.** Name the covered surface (public factories, interfaces, events); anything *unlisted* (experimental modules, internal workstream churn) is free to change without ceremony. Our allowlist = `packages/sdk/src/types.ts` + `adapters/types.ts` + `events.ts`.
2. **Confine breaking changes to major releases** — *"if it works today, it works after a minor upgrade"* (OpenZeppelin). Any backward-incompatible change to a listed symbol forces a major bump.
3. **Expose functionality only through the typed interfaces**, never concrete impls — which we already do.

> **Refuted (0-3):** "every new version must *perpetually* support all older versions." SemVer *signals* breakage; it does **not** mandate perpetual backward compatibility across majors. For a hackathon, a `0.x` pre-1.0 convention (minor bumps *may* break) is the pragmatic fit.

Sources: [k6 stability guarantees](https://grafana.com/docs/k6/latest/reference/versioning-and-stability-guarantees/), [OpenZeppelin releases & stability](https://docs.openzeppelin.com/contracts/4.x/releases-stability), [semver.org](https://semver.org), [JS SDK Design Guide](https://sdk-design.js.org/).

## 8. Documentation practices 🟡

For an SDK meant to be picked up fast:
- **Lead with a quickstart** that gets one working call in the fewest possible steps — fast first success beats completeness. For us: a copy-paste `configureRentgen(...)` + two widget tags that runs against `stub.ts` offline.
- **Separate doc types** rather than one wall of text: getting-started · API reference · examples · versioning/stability. (Our split: [`README`](../README.md) = quickstart, this file = rationale, the spec = authoritative design, workstream specs = per-owner contracts.)
- **Be idiomatic to the host** (React consumers expect props + events, not imperative calls) — the `@lit/react` shell delivers this.

Sources: [Speakeasy](https://www.speakeasy.com/api-design/documentation/), [Fern](https://buildwithfern.com/post/api-documentation-best-practices-guide), [Auth0 SDK principles](https://auth0.com/blog/guiding-principles-for-building-sdks/), [ReadMe quickstarts](https://blog.readme.com/the-most-effective-api-quickstarts-in-8-examples/).

---

## Anti-patterns — verified *false*, do NOT adopt

| Refuted claim | Vote |
|---|---|
| Ship *aggressive permissive defaults that collect rich context* without opt-in | 0-3 |
| "React *cannot* set properties on custom elements at all" | 0-3 |
| Every new version must *perpetually* support all older versions | 0-3 |
| A dedicated deep-merge is *categorically* better for typing | 0-3 |
| Web components are *the best* foundation, avoiding framework lock-in | 0-3 |
| Centralized plugin registry/manager with `initialize(context)` lifecycle | 1-2 |
| Plugins interact *only* via a shared `appContext`, never importing core | 1-2 |

Sensible defaults are endorsed — **aggressive implicit data collection is not.** The separation-of-concerns pattern is endorsed — **"web components are universally best" is not.**

## Open items worth a decision

1. **Runtime validation at the seams.** Compile-time contracts don't cover adapter I/O — TS types erase, and adapters call external APIs. Our coding-style rules mandate boundary validation. Candidate: **Zod schemas on `DetectedObject` / `EnrichedItem`** at adapter outputs. *(Shared concern — touches the frozen `types.ts`; agree with Workstream 4 / the team before adding.)*
2. **Registration wiring.** The two "centralized registry/manager" claims were the *refuted* ones — so prefer **direct injection of adapter instances** via `configureRentgen`, which our design already leans toward, over a manager abstraction.
3. **Monorepo versioning during parallel work.** Interfaces frozen, internal modules churning → a **`0.x` pre-1.0 convention** fits better than strict independent per-package SemVer.
4. **Tavily CORS/transport swap.** Under the enumerated-allowlist policy, swapping *only the transport* inside `tavily-comps.ts` while keeping the interface stable is **non-breaking** — the interface is the covered symbol, the transport isn't. (Confirms the §9 mitigation in the spec.)

---

*Sourcing note: versioning/stability, configuration, and Lit/theming findings rest on primary vendor/spec sources (high confidence). Plugin-architecture mechanics rest on developer blogs, but the underlying principles (Dependency Inversion, Open/Closed, Ports & Adapters) are canonical and independently corroborated. The OpenZeppelin stability model is from Solidity — the enumerate-covered-symbols principle generalizes, but its specific symbol categories don't map 1:1 onto a TS SDK.*
