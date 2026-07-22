# Rentgen Marketing Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone `apps/website` marketing landing page for Rentgen, centered on a draggable "x-ray" reveal hero with a live idle-capital counter, following `docs/superpowers/specs/2026-07-18-website-landing-design.md`.

**Architecture:** A new, fully decoupled Vite + React + TypeScript workspace (`apps/website`) with no dependency on `@rentgen/sdk`. The hero's drag mechanic is a single clamped `reveal` state (0–100) lifted into `Hero.tsx`, driving a CSS `clip-path` split between a muted "before" layer and a green x-ray "after" layer, per-item pop-in markers, and a linearly-derived money counter — all from that one number. Content sections below the hero are static React components assembled in `App.tsx`.

**Tech Stack:** React 19, Vite 6, TypeScript 5.7 (strict), plain CSS with custom properties (no CSS framework, matching `apps/app`'s existing pattern of hand-written CSS + Lit web components — here plain React/CSS since there are no widgets to embed).

## Global Constraints

- Zero backend, no network calls from this workspace — static marketing content only, no dependency on `@rentgen/sdk` (spec: "Tech structure").
- Color tokens (exact values, "Financial Dashboard" palette): background `#020617`, card `#0E1223`, foreground `#F8FAFC`, accent `#22C55E`, muted border `#334155`, muted foreground `#94A3B8`, destructive `#EF4444` (spec: "Visual system").
- Typography: **Space Grotesk** for headings, **DM Sans** for body text (spec: "Visual system").
- No invented statistics anywhere in copy. Privacy copy uses the "nothing is stored" framing — never "your video never leaves the server" (spec: "Privacy claim decision", "Copy → Honesty note").
- No automated test framework — this repo has a deliberate hackathon scope cut on automated tests (`CLAUDE.md`: "No automated tests — deliberate hackathon scope cut"). Every task's verification step is manual: `npm run typecheck:website`, `npm run build:website`, and a browser smoke check.
- Root `package.json`'s existing `dev`, `build`, and `typecheck` scripts (bound to `apps/app`) must not be modified — only new, additive `:website`-suffixed scripts are added.
- The hero's `reveal` value is always clamped to `[0, 100]`; the money counter is derived directly and linearly from `reveal` (`amount = round(reveal / 100 * 4200)`), never time-based (spec: "Hero mechanic").
- `prefers-reduced-motion` must be respected: the hero's auto-sweep-on-load is skipped entirely, and all CSS transitions collapse to nearly instant (spec: "Hero mechanic", "Error handling & edge cases").

---

### Task 1: Scaffold the `apps/website` workspace

**Files:**
- Create: `apps/website/package.json`
- Create: `apps/website/tsconfig.json`
- Create: `apps/website/vite.config.ts`
- Create: `apps/website/index.html`
- Create: `apps/website/src/App.tsx`
- Create: `apps/website/src/main.tsx`
- Modify: `package.json` (root)

**Interfaces:**
- Produces: `App` component (default export not used — named export `App` from `apps/website/src/App.tsx`), root npm scripts `dev:website`, `build:website`, `typecheck:website`.

- [ ] **Step 1: Create the workspace package.json**

```json
{
  "name": "@rentgen/website",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Rentgen's marketing landing page.",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.7.2",
    "vite": "^6.0.5"
  }
}
```

- [ ] **Step 2: Create tsconfig.json extending the shared base**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

- [ ] **Step 4: Create index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Rentgen — your room is worth more than you think</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create a minimal App.tsx to verify the scaffold boots**

```tsx
export function App() {
  return <h1>Rentgen</h1>;
}
```

- [ ] **Step 6: Create main.tsx**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 7: Add additive scripts to the root package.json**

Modify `package.json` at repo root — add three new keys to `"scripts"`, leaving `dev`, `build`, `build:sdk`, `typecheck` untouched:

```json
{
  "scripts": {
    "dev": "npm run dev -w app",
    "build": "npm run build -w @rentgen/sdk && npm run build -w app",
    "build:sdk": "npm run build -w @rentgen/sdk",
    "typecheck": "npm run typecheck -w @rentgen/sdk && npm run typecheck -w app",
    "dev:website": "npm run dev -w @rentgen/website",
    "build:website": "npm run build -w @rentgen/website",
    "typecheck:website": "npm run typecheck -w @rentgen/website"
  }
}
```

- [ ] **Step 8: Install to link the new workspace**

Run: `npm install`
Expected: completes without error; `apps/website` now resolves as a workspace (check with `npm ls @rentgen/website` — expect it listed at the root).

- [ ] **Step 9: Verify typecheck passes**

Run: `npm run typecheck:website`
Expected: exits 0, no output (or only the tsc success silence).

- [ ] **Step 10: Verify the dev server boots**

Run: `npm run dev:website`
Expected: Vite prints a local URL (typically `http://localhost:5173`). Open it in a browser and confirm a page with the text "Rentgen" renders. Stop the server (Ctrl+C) once confirmed.

- [ ] **Step 11: Commit**

```bash
git add apps/website package.json
git commit -m "feat(website): scaffold apps/website workspace"
```

---

### Task 2: Global theme (CSS custom properties + fonts + reset)

**Files:**
- Create: `apps/website/src/styles/global.css`
- Modify: `apps/website/src/main.tsx` (import the stylesheet)
- Modify: `apps/website/index.html` (font links)

**Interfaces:**
- Consumes: none.
- Produces: CSS custom properties (`--color-bg`, `--color-card`, `--color-fg`, `--color-accent`, `--color-muted-border`, `--color-muted-fg`, `--color-destructive`, `--font-heading`, `--font-body`, `--space-1`..`--space-7`, `--radius-md`, `--focus-ring`), a reusable `.section` class, and a global `prefers-reduced-motion` rule that every later task's transitions rely on.

- [ ] **Step 1: Create global.css**

```css
:root {
  --color-bg: #020617;
  --color-card: #0e1223;
  --color-fg: #f8fafc;
  --color-accent: #22c55e;
  --color-muted-border: #334155;
  --color-muted-fg: #94a3b8;
  --color-destructive: #ef4444;

  --font-heading: 'Space Grotesk', sans-serif;
  --font-body: 'DM Sans', sans-serif;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 16px;
  --space-4: 24px;
  --space-5: 32px;
  --space-6: 48px;
  --space-7: 64px;

  --radius-md: 12px;
  --focus-ring: 0 0 0 3px rgba(34, 197, 94, 0.6);
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  min-height: 100%;
}

body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-fg);
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

h1,
h2,
h3 {
  font-family: var(--font-heading);
  margin: 0;
  line-height: 1.2;
}

p {
  margin: 0;
}

a {
  color: inherit;
}

button {
  font-family: inherit;
  color: inherit;
  background: none;
  border: none;
  cursor: pointer;
}

:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.section {
  max-width: 960px;
  margin: 0 auto;
  padding: var(--space-7) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 2: Import global.css in main.tsx**

Modify `apps/website/src/main.tsx` — add the import as the first line:

```tsx
import './styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 3: Add font links to index.html**

Modify `apps/website/index.html` — add inside `<head>`, after the viewport meta tag:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;600;700&display=swap"
  rel="stylesheet"
/>
```

- [ ] **Step 4: Verify visually**

Run: `npm run dev:website`, open the printed URL. Expected: dark navy background, white "Rentgen" heading rendered in Space Grotesk (visibly geometric/technical, distinct from the fallback sans-serif). Stop the server.

- [ ] **Step 5: Verify typecheck still passes**

Run: `npm run typecheck:website`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/styles apps/website/src/main.tsx apps/website/index.html
git commit -m "feat(website): add dark+green theme and font loading"
```

---

### Task 3: X-ray reveal mechanic + Hero shell

**Files:**
- Create: `apps/website/src/hero/XrayReveal.tsx`
- Create: `apps/website/src/sections/Hero.tsx`
- Modify: `apps/website/src/App.tsx`
- Modify: `apps/website/src/styles/global.css`

**Interfaces:**
- Consumes: theme CSS custom properties from Task 2.
- Produces: `XrayReveal` component — `interface XrayRevealProps { reveal: number; onRevealChange: (value: number) => void; beforeContent: React.ReactNode; afterContent: React.ReactNode }` — and `clampReveal(value: number): number`, both used by Task 4, 5, 6. `Hero` component (named export) consumed by `App.tsx` and further modified by Tasks 4–6.

- [ ] **Step 1: Create XrayReveal.tsx**

```tsx
import { useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';

export interface XrayRevealProps {
  reveal: number;
  onRevealChange: (value: number) => void;
  beforeContent: ReactNode;
  afterContent: ReactNode;
}

const KEYBOARD_STEP = 5;

export function clampReveal(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function XrayReveal({ reveal, onRevealChange, beforeContent, afterContent }: XrayRevealProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const pendingClientXRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const revealFromClientX = useCallback((clientX: number): number => {
    const track = trackRef.current;
    if (!track) return reveal;
    const rect = track.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    return clampReveal(ratio * 100);
  }, [reveal]);

  const flushPendingMove = useCallback(() => {
    rafRef.current = null;
    if (pendingClientXRef.current === null) return;
    const nextReveal = revealFromClientX(pendingClientXRef.current);
    pendingClientXRef.current = null;
    onRevealChange(nextReveal);
  }, [onRevealChange, revealFromClientX]);

  const schedulePendingMove = useCallback((clientX: number) => {
    pendingClientXRef.current = clientX;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flushPendingMove);
    }
  }, [flushPendingMove]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    schedulePendingMove(event.clientX);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    schedulePendingMove(event.clientX);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onRevealChange(clampReveal(reveal - KEYBOARD_STEP));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      onRevealChange(clampReveal(reveal + KEYBOARD_STEP));
    } else if (event.key === 'Home') {
      event.preventDefault();
      onRevealChange(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      onRevealChange(100);
    }
  };

  return (
    <div
      ref={trackRef}
      className="xray-reveal"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="xray-reveal__before">{beforeContent}</div>
      <div className="xray-reveal__after" style={{ clipPath: `inset(0 ${100 - reveal}% 0 0)` }}>
        {afterContent}
      </div>
      <div className="xray-reveal__line" style={{ left: `${reveal}%` }}>
        <button
          type="button"
          className="xray-reveal__handle"
          role="slider"
          aria-label="Reveal hidden value in the room"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(reveal)}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create Hero.tsx with real copy and neutral placeholder layers**

```tsx
import { useState } from 'react';
import { XrayReveal } from '../hero/XrayReveal';

export function Hero() {
  const [reveal, setReveal] = useState(0);

  return (
    <section className="hero" aria-label="Rentgen interactive demo">
      <div className="hero__copy">
        <h1 className="hero__headline">Your room is worth more than you think.</h1>
        <p className="hero__subhead">Drag the line. Watch dead capital turn into cash.</p>
        <a className="hero__cta" href="#sdk">
          Try the scan
        </a>
      </div>
      <div className="hero__stage">
        <XrayReveal
          reveal={reveal}
          onRevealChange={setReveal}
          beforeContent={<div className="hero__layer-fill hero__layer-fill--before" />}
          afterContent={<div className="hero__layer-fill hero__layer-fill--after" />}
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Wire Hero into App.tsx**

```tsx
import { Hero } from './sections/Hero';

export function App() {
  return <Hero />;
}
```

- [ ] **Step 4: Append hero + xray-reveal styles to global.css**

Append to `apps/website/src/styles/global.css`:

```css
.hero {
  max-width: 1100px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.hero__copy {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 640px;
}

.hero__headline {
  font-size: clamp(2rem, 5vw, 3.25rem);
  font-weight: 600;
}

.hero__subhead {
  color: var(--color-muted-fg);
  font-size: 1.125rem;
}

.hero__cta {
  align-self: flex-start;
  margin-top: var(--space-2);
  padding: var(--space-3) var(--space-5);
  background: var(--color-accent);
  color: var(--color-bg);
  font-weight: 600;
  border-radius: var(--radius-md);
  text-decoration: none;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}

.hero__stage {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

@media (min-width: 768px) {
  .hero__stage {
    flex-direction: row-reverse;
    align-items: center;
  }
}

.xray-reveal {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-muted-border);
  touch-action: none;
  user-select: none;
}

@media (min-width: 768px) {
  .xray-reveal {
    aspect-ratio: 16 / 10;
  }
}

.xray-reveal__before,
.xray-reveal__after {
  position: absolute;
  inset: 0;
}

.xray-reveal__before {
  background: var(--color-card);
}

.xray-reveal__after {
  background: linear-gradient(90deg, rgba(34, 197, 94, 0.16), rgba(34, 197, 94, 0.04));
}

.hero__layer-fill {
  position: absolute;
  inset: 0;
}

.xray-reveal__line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--color-accent);
  box-shadow: 0 0 12px var(--color-accent);
  transform: translateX(-50%);
}

.xray-reveal__handle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--color-accent);
  cursor: ew-resize;
}
```

- [ ] **Step 5: Verify drag and keyboard interaction manually**

Run: `npm run dev:website`, open the printed URL. Expected: a bordered box with a muted-gray left region and a faint green-tinted right region, split by a green vertical line with a circular handle. Drag the handle with the mouse — confirm the boundary between the two backgrounds follows the cursor smoothly across the full width. Click the handle to focus it, then press ArrowRight/ArrowLeft — confirm the line moves in 5% steps; press Home/End — confirm it jumps to the far left/right. Stop the server.

- [ ] **Step 6: Verify typecheck passes**

Run: `npm run typecheck:website`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add apps/website/src/hero apps/website/src/sections apps/website/src/App.tsx apps/website/src/styles/global.css
git commit -m "feat(website): add draggable x-ray reveal hero mechanic"
```

---

### Task 4: Room illustration + item markers

**Files:**
- Create: `apps/website/src/hero/items.ts`
- Create: `apps/website/src/hero/formatCurrency.ts`
- Create: `apps/website/src/hero/ItemIcons.tsx`
- Create: `apps/website/src/hero/ItemMarker.tsx`
- Create: `apps/website/src/hero/RoomIllustration.tsx`
- Modify: `apps/website/src/sections/Hero.tsx`
- Modify: `apps/website/src/styles/global.css`

**Interfaces:**
- Consumes: `XrayReveal` from Task 3 (`beforeContent`/`afterContent` slots).
- Produces: `REVEAL_ITEMS: RevealItem[]` and `REVEAL_ITEMS_TOTAL: number` (consumed by Task 5's `MoneyCounter`); `formatCurrency(amount: number): string` (consumed by Task 5); `RevealItemId` type.

- [ ] **Step 1: Create items.ts**

```typescript
export type RevealItemId = 'bike' | 'guitar' | 'camera' | 'drone' | 'lamp' | 'sofa';

export interface RevealItem {
  id: RevealItemId;
  label: string;
  value: number;
  /** 0-100: position within the hero canvas, and the reveal % at which this item's tag animates in. */
  x: number;
  /** 0-100: vertical position within the hero canvas. */
  y: number;
}

export const REVEAL_ITEMS: RevealItem[] = [
  { id: 'bike', label: 'Bike', value: 350, x: 14, y: 62 },
  { id: 'guitar', label: 'Guitar', value: 220, x: 30, y: 40 },
  { id: 'camera', label: 'Camera', value: 480, x: 48, y: 58 },
  { id: 'drone', label: 'Drone', value: 650, x: 62, y: 30 },
  { id: 'lamp', label: 'Lamp', value: 150, x: 76, y: 48 },
  { id: 'sofa', label: 'Sofa', value: 2350, x: 88, y: 65 },
];

export const REVEAL_ITEMS_TOTAL = REVEAL_ITEMS.reduce((sum, item) => sum + item.value, 0);
```

- [ ] **Step 2: Create formatCurrency.ts**

```typescript
const formatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number): string {
  return formatter.format(amount);
}
```

- [ ] **Step 3: Create ItemIcons.tsx**

```tsx
import type { RevealItemId } from './items';

export interface ItemIconProps {
  id: RevealItemId;
}

export function ItemIcon({ id }: ItemIconProps) {
  switch (id) {
    case 'bike':
      return (
        <svg viewBox="0 0 24 24" className="item-marker__icon" aria-hidden="true">
          <circle cx="6" cy="17" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="18" cy="17" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M6 17 L11 8 L16 17 M11 8 L14 8 M9 12 L16 12 L18 17"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'guitar':
      return (
        <svg viewBox="0 0 24 24" className="item-marker__icon" aria-hidden="true">
          <circle cx="9" cy="16" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="11" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="12" y1="8" x2="17" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'camera':
      return (
        <svg viewBox="0 0 24 24" className="item-marker__icon" aria-hidden="true">
          <rect x="3" y="7" width="18" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <rect x="8" y="4" width="6" height="3" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="12" cy="13.5" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case 'drone':
      return (
        <svg viewBox="0 0 24 24" className="item-marker__icon" aria-hidden="true">
          <rect x="10" y="10" width="4" height="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10" y1="10" x2="4" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="14" y1="10" x2="20" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="10" y1="14" x2="4" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="14" y1="14" x2="20" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="4" cy="4" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="20" cy="4" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="4" cy="20" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="20" cy="20" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case 'lamp':
      return (
        <svg viewBox="0 0 24 24" className="item-marker__icon" aria-hidden="true">
          <path d="M7 5 L17 5 L14 12 L10 12 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <line x1="12" y1="12" x2="12" y2="19" stroke="currentColor" strokeWidth="1.5" />
          <line x1="8" y1="20" x2="16" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'sofa':
      return (
        <svg viewBox="0 0 24 24" className="item-marker__icon" aria-hidden="true">
          <rect x="3" y="11" width="18" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <rect x="3" y="8" width="4" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <rect x="17" y="8" width="4" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="5" y1="18" x2="5" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="19" y1="18" x2="19" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}
```

- [ ] **Step 4: Create ItemMarker.tsx**

```tsx
import type { RevealItem } from './items';
import { ItemIcon } from './ItemIcons';
import { formatCurrency } from './formatCurrency';

export interface ItemMarkerProps {
  item: RevealItem;
  revealed: boolean;
}

export function ItemMarker({ item, revealed }: ItemMarkerProps) {
  return (
    <div
      className={`item-marker${revealed ? ' item-marker--revealed' : ''}`}
      style={{ left: `${item.x}%`, top: `${item.y}%` }}
    >
      <ItemIcon id={item.id} />
      <span className="item-marker__tag">
        {item.label} · {formatCurrency(item.value)}
      </span>
    </div>
  );
}
```

- [ ] **Step 5: Create RoomIllustration.tsx**

```tsx
export interface RoomIllustrationProps {
  variant: 'before' | 'after';
}

export function RoomIllustration({ variant }: RoomIllustrationProps) {
  const stroke = variant === 'before' ? 'var(--color-muted-border)' : 'var(--color-accent)';
  const opacity = variant === 'before' ? 0.6 : 0.9;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={`room-illustration room-illustration--${variant}`}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="96" height="96" rx="2" fill="none" stroke={stroke} strokeWidth="0.6" opacity={opacity} />
      <rect x="6" y="64" width="24" height="24" rx="1.5" fill="none" stroke={stroke} strokeWidth="0.6" opacity={opacity} />
      <rect x="70" y="15" width="16" height="55" rx="1" fill="none" stroke={stroke} strokeWidth="0.6" opacity={opacity} />
      <line x1="2" y1="80" x2="98" y2="80" stroke={stroke} strokeWidth="0.4" opacity={opacity * 0.6} />
    </svg>
  );
}
```

- [ ] **Step 6: Wire room illustration + item markers into Hero.tsx**

Replace the `<XrayReveal ... />` block in `apps/website/src/sections/Hero.tsx`:

```tsx
import { useState } from 'react';
import { XrayReveal } from '../hero/XrayReveal';
import { RoomIllustration } from '../hero/RoomIllustration';
import { ItemMarker } from '../hero/ItemMarker';
import { REVEAL_ITEMS } from '../hero/items';

export function Hero() {
  const [reveal, setReveal] = useState(0);

  return (
    <section className="hero" aria-label="Rentgen interactive demo">
      <div className="hero__copy">
        <h1 className="hero__headline">Your room is worth more than you think.</h1>
        <p className="hero__subhead">Drag the line. Watch dead capital turn into cash.</p>
        <a className="hero__cta" href="#sdk">
          Try the scan
        </a>
      </div>
      <div className="hero__stage">
        <XrayReveal
          reveal={reveal}
          onRevealChange={setReveal}
          beforeContent={<RoomIllustration variant="before" />}
          afterContent={
            <>
              <RoomIllustration variant="after" />
              {REVEAL_ITEMS.map((item) => (
                <ItemMarker key={item.id} item={item} revealed={reveal >= item.x} />
              ))}
            </>
          }
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Append item marker + room illustration styles to global.css**

Append to `apps/website/src/styles/global.css`:

```css
.room-illustration {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.item-marker {
  position: absolute;
  transform: translate(-50%, -50%) scale(0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-accent);
  opacity: 0;
  transition: opacity 220ms ease-out, transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
  pointer-events: none;
}

.item-marker--revealed {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

.item-marker__icon {
  width: 28px;
  height: 28px;
  filter: drop-shadow(0 0 6px rgba(34, 197, 94, 0.7));
}

.item-marker__tag {
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--color-accent);
  color: var(--color-bg);
  white-space: nowrap;
}
```

- [ ] **Step 8: Verify item pop-in behavior manually**

Run: `npm run dev:website`, open the printed URL. Expected: an outlined "room" shape (a large rect with a smaller rect near the bottom-left and a tall rect on the right) in muted gray on the left of the line. Drag the handle slowly rightward — confirm each of the 6 item icons (bike, guitar, camera, drone, lamp, sofa) fades and scales in, one at a time, roughly in that left-to-right order, each showing its label and euro value. Drag back left — confirm items disappear again as the line passes back over them. Stop the server.

- [ ] **Step 9: Verify typecheck passes**

Run: `npm run typecheck:website`
Expected: exits 0.

- [ ] **Step 10: Commit**

```bash
git add apps/website/src/hero apps/website/src/sections/Hero.tsx apps/website/src/styles/global.css
git commit -m "feat(website): add room illustration and per-item reveal markers"
```

---

### Task 5: Money counter

**Files:**
- Create: `apps/website/src/hero/MoneyCounter.tsx`
- Modify: `apps/website/src/sections/Hero.tsx`
- Modify: `apps/website/src/styles/global.css`

**Interfaces:**
- Consumes: `REVEAL_ITEMS_TOTAL` from `apps/website/src/hero/items.ts` (Task 4), `formatCurrency` from `apps/website/src/hero/formatCurrency.ts` (Task 4), `clampReveal` from `apps/website/src/hero/XrayReveal.tsx` (Task 3).
- Produces: `MoneyCounter` component — `interface MoneyCounterProps { reveal: number }` — consumed by `Hero.tsx`.

- [ ] **Step 1: Create MoneyCounter.tsx**

```tsx
import { REVEAL_ITEMS_TOTAL } from './items';
import { formatCurrency } from './formatCurrency';
import { clampReveal } from './XrayReveal';

export interface MoneyCounterProps {
  reveal: number;
}

export function MoneyCounter({ reveal }: MoneyCounterProps) {
  const clamped = clampReveal(reveal);
  const amount = Math.round((clamped / 100) * REVEAL_ITEMS_TOTAL);

  return (
    <div className="money-counter" role="status" aria-live="polite">
      <span className="money-counter__value">{formatCurrency(amount)}</span>
      <span className="money-counter__label">per month, idle in your room</span>
    </div>
  );
}
```

- [ ] **Step 2: Wire MoneyCounter into Hero.tsx**

Modify `apps/website/src/sections/Hero.tsx` — add the import and render it as the first child of `.hero__stage`, before `XrayReveal`:

```tsx
import { useState } from 'react';
import { XrayReveal } from '../hero/XrayReveal';
import { RoomIllustration } from '../hero/RoomIllustration';
import { ItemMarker } from '../hero/ItemMarker';
import { MoneyCounter } from '../hero/MoneyCounter';
import { REVEAL_ITEMS } from '../hero/items';

export function Hero() {
  const [reveal, setReveal] = useState(0);

  return (
    <section className="hero" aria-label="Rentgen interactive demo">
      <div className="hero__copy">
        <h1 className="hero__headline">Your room is worth more than you think.</h1>
        <p className="hero__subhead">Drag the line. Watch dead capital turn into cash.</p>
        <a className="hero__cta" href="#sdk">
          Try the scan
        </a>
      </div>
      <div className="hero__stage">
        <MoneyCounter reveal={reveal} />
        <XrayReveal
          reveal={reveal}
          onRevealChange={setReveal}
          beforeContent={<RoomIllustration variant="before" />}
          afterContent={
            <>
              <RoomIllustration variant="after" />
              {REVEAL_ITEMS.map((item) => (
                <ItemMarker key={item.id} item={item} revealed={reveal >= item.x} />
              ))}
            </>
          }
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Append money counter styles to global.css**

Append to `apps/website/src/styles/global.css`:

```css
.money-counter {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex-shrink: 0;
}

@media (min-width: 768px) {
  .money-counter {
    align-items: flex-start;
  }
}

.money-counter__value {
  font-family: var(--font-heading);
  font-variant-numeric: tabular-nums;
  font-size: clamp(2rem, 6vw, 3rem);
  font-weight: 700;
  color: var(--color-accent);
}

.money-counter__label {
  color: var(--color-muted-fg);
  font-size: 0.875rem;
}
```

- [ ] **Step 4: Verify counter behavior manually**

Run: `npm run dev:website`, open the printed URL. Expected: on page load (before dragging), the counter reads "0 €" (or your locale's zero-euro formatting). Drag the handle fully to the right — confirm the counter climbs smoothly and reads exactly "4.200 €" at 100% reveal. Drag back to 0 — confirm it returns to "0 €". Resize the browser window below ~768px — confirm the counter sits above the reveal canvas instead of beside it. Stop the server.

- [ ] **Step 5: Verify typecheck passes**

Run: `npm run typecheck:website`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/hero/MoneyCounter.tsx apps/website/src/sections/Hero.tsx apps/website/src/styles/global.css
git commit -m "feat(website): add idle-capital money counter to hero"
```

---

### Task 6: Auto-sweep-on-load affordance

**Files:**
- Create: `apps/website/src/hero/useAutoSweep.ts`
- Modify: `apps/website/src/sections/Hero.tsx`

**Interfaces:**
- Consumes: `clampReveal` is not needed here (the sweep computes its own bounded progress); consumes `setReveal` (the `onRevealChange` setter) from `Hero.tsx`'s existing `useState`.
- Produces: `useAutoSweep(onRevealChange: (value: number) => void): void`, called once from `Hero.tsx`.

- [ ] **Step 1: Create useAutoSweep.ts**

```typescript
import { useEffect, useRef } from 'react';

const SWEEP_TARGET = 35;
const SWEEP_DURATION_MS = 1400;

export function useAutoSweep(onRevealChange: (value: number) => void): void {
  const hasSweptRef = useRef(false);

  useEffect(() => {
    if (hasSweptRef.current) return;
    hasSweptRef.current = true;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const startTime = performance.now();
    let frameId: number;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / SWEEP_DURATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      onRevealChange(eased * SWEEP_TARGET);
      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [onRevealChange]);
}
```

- [ ] **Step 2: Wire the hook into Hero.tsx**

Modify `apps/website/src/sections/Hero.tsx` — add the import and call the hook right after the `useState` line:

```tsx
import { useState } from 'react';
import { XrayReveal } from '../hero/XrayReveal';
import { RoomIllustration } from '../hero/RoomIllustration';
import { ItemMarker } from '../hero/ItemMarker';
import { MoneyCounter } from '../hero/MoneyCounter';
import { useAutoSweep } from '../hero/useAutoSweep';
import { REVEAL_ITEMS } from '../hero/items';

export function Hero() {
  const [reveal, setReveal] = useState(0);
  useAutoSweep(setReveal);

  return (
    <section className="hero" aria-label="Rentgen interactive demo">
      <div className="hero__copy">
        <h1 className="hero__headline">Your room is worth more than you think.</h1>
        <p className="hero__subhead">Drag the line. Watch dead capital turn into cash.</p>
        <a className="hero__cta" href="#sdk">
          Try the scan
        </a>
      </div>
      <div className="hero__stage">
        <MoneyCounter reveal={reveal} />
        <XrayReveal
          reveal={reveal}
          onRevealChange={setReveal}
          beforeContent={<RoomIllustration variant="before" />}
          afterContent={
            <>
              <RoomIllustration variant="after" />
              {REVEAL_ITEMS.map((item) => (
                <ItemMarker key={item.id} item={item} revealed={reveal >= item.x} />
              ))}
            </>
          }
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify the sweep manually**

Run: `npm run dev:website`, open the printed URL, then hard-reload the page. Expected: over roughly 1.4 seconds, the scan line sweeps from the far left to about a third of the way across and stops there; the bike and guitar markers pop in; the counter climbs to roughly "1.470 €" (35% of 4.200) and holds. Dragging afterward still works normally from that settled position.

- [ ] **Step 4: Verify reduced-motion skips the sweep**

In Chrome DevTools, open the Rendering tab (Cmd/Ctrl+Shift+P → "Show Rendering"), set "Emulate CSS media feature prefers-reduced-motion" to "reduce", then hard-reload the page. Expected: the line stays at 0% and the counter stays at "0 €" — no automatic sweep occurs. Turn the emulation back off afterward.

- [ ] **Step 5: Verify typecheck passes**

Run: `npm run typecheck:website`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/hero/useAutoSweep.ts apps/website/src/sections/Hero.tsx
git commit -m "feat(website): auto-sweep the hero reveal once on load"
```

---

### Task 7: Problem section

**Files:**
- Create: `apps/website/src/sections/Problem.tsx`
- Modify: `apps/website/src/App.tsx`
- Modify: `apps/website/src/styles/global.css`

**Interfaces:**
- Consumes: `.section` base class from Task 2.
- Produces: `Problem` component consumed by `App.tsx`.

- [ ] **Step 1: Create Problem.tsx**

```tsx
export function Problem() {
  return (
    <section className="section problem" aria-labelledby="problem-heading">
      <h2 id="problem-heading">Everyone has dead capital lying around.</h2>
      <ul className="problem__examples">
        <li>The bike you haven&rsquo;t ridden since spring.</li>
        <li>The camera from three phones ago.</li>
        <li>The drawer of cables for gear you no longer own.</li>
        <li>The guitar leaning in the corner, untouched for a year.</li>
      </ul>
      <p className="problem__lede">
        None of it is trash. Most of it is just sitting there, worth real money, waiting to be noticed.
      </p>
    </section>
  );
}
```

- [ ] **Step 2: Wire Problem into App.tsx**

```tsx
import { Hero } from './sections/Hero';
import { Problem } from './sections/Problem';

export function App() {
  return (
    <>
      <Hero />
      <Problem />
    </>
  );
}
```

- [ ] **Step 3: Append problem section styles to global.css**

Append to `apps/website/src/styles/global.css`:

```css
.problem__examples {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.problem__examples li {
  padding-left: var(--space-4);
  position: relative;
  color: var(--color-fg);
}

.problem__examples li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.6em;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-accent);
}

.problem__lede {
  color: var(--color-muted-fg);
  font-size: 1.0625rem;
}
```

- [ ] **Step 4: Verify visually**

Run: `npm run dev:website`, open the printed URL, scroll below the hero. Expected: a heading "Everyone has dead capital lying around.", four bulleted examples with small green dot markers, then a closing muted line.

- [ ] **Step 5: Verify typecheck passes**

Run: `npm run typecheck:website`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/sections/Problem.tsx apps/website/src/App.tsx apps/website/src/styles/global.css
git commit -m "feat(website): add problem section"
```

---

### Task 8: How it works section

**Files:**
- Create: `apps/website/src/sections/HowItWorks.tsx`
- Modify: `apps/website/src/App.tsx`
- Modify: `apps/website/src/styles/global.css`

**Interfaces:**
- Consumes: `.section` base class from Task 2.
- Produces: `HowItWorks` component consumed by `App.tsx`.

- [ ] **Step 1: Create HowItWorks.tsx**

```tsx
interface Step {
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    title: 'Scan your room',
    description: "Point your phone at your things. That's it — no forms, no listing text to write.",
  },
  {
    title: 'We identify each item',
    description: 'Vision AI recognizes what you’re looking at, item by item, in real time.',
  },
  {
    title: 'See resale + rent/day, instantly',
    description: 'Prices are grounded in live web comps, not guesses — so the number on screen is real.',
  },
];

export function HowItWorks() {
  return (
    <section className="section how-it-works" aria-labelledby="how-it-works-heading">
      <h2 id="how-it-works-heading">Scan. Identify. Price.</h2>
      <ol className="how-it-works__steps">
        {STEPS.map((step, index) => (
          <li key={step.title} className="how-it-works__step">
            <span className="how-it-works__step-number" aria-hidden="true">
              {index + 1}
            </span>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
```

- [ ] **Step 2: Wire HowItWorks into App.tsx**

```tsx
import { Hero } from './sections/Hero';
import { Problem } from './sections/Problem';
import { HowItWorks } from './sections/HowItWorks';

export function App() {
  return (
    <>
      <Hero />
      <Problem />
      <HowItWorks />
    </>
  );
}
```

- [ ] **Step 3: Append how-it-works styles to global.css**

Append to `apps/website/src/styles/global.css`:

```css
.how-it-works__steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-4);
}

@media (min-width: 768px) {
  .how-it-works__steps {
    grid-template-columns: repeat(3, 1fr);
  }
}

.how-it-works__step {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--color-card);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-muted-border);
}

.how-it-works__step-number {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-accent);
  color: var(--color-bg);
  font-weight: 700;
}

.how-it-works__step p {
  color: var(--color-muted-fg);
}
```

- [ ] **Step 4: Verify visually**

Run: `npm run dev:website`, open the printed URL, scroll to the third section. Expected: heading "Scan. Identify. Price.", three cards each with a numbered green circle, a bold title, and a muted description; cards sit in a 3-column grid on desktop widths and stack on narrow widths.

- [ ] **Step 5: Verify typecheck passes**

Run: `npm run typecheck:website`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/sections/HowItWorks.tsx apps/website/src/App.tsx apps/website/src/styles/global.css
git commit -m "feat(website): add how-it-works section"
```

---

### Task 9: Trust / privacy section

**Files:**
- Create: `apps/website/src/sections/Trust.tsx`
- Modify: `apps/website/src/App.tsx`
- Modify: `apps/website/src/styles/global.css`

**Interfaces:**
- Consumes: `.section` base class from Task 2.
- Produces: `Trust` component consumed by `App.tsx`.

- [ ] **Step 1: Create Trust.tsx**

```tsx
export function Trust() {
  return (
    <section className="section trust" aria-labelledby="trust-heading">
      <h2 id="trust-heading">Nothing is stored.</h2>
      <p>
        Every frame is processed in real time, then it&rsquo;s gone. There is no server-side storage, no
        database, no video sitting on a hard drive somewhere — Rentgen runs with zero backend by design.
      </p>
    </section>
  );
}
```

- [ ] **Step 2: Wire Trust into App.tsx**

```tsx
import { Hero } from './sections/Hero';
import { Problem } from './sections/Problem';
import { HowItWorks } from './sections/HowItWorks';
import { Trust } from './sections/Trust';

export function App() {
  return (
    <>
      <Hero />
      <Problem />
      <HowItWorks />
      <Trust />
    </>
  );
}
```

- [ ] **Step 3: Append trust section styles to global.css**

Append to `apps/website/src/styles/global.css`:

```css
.trust {
  max-width: 720px;
}

.trust p {
  color: var(--color-muted-fg);
  font-size: 1.0625rem;
}
```

- [ ] **Step 4: Verify visually**

Run: `npm run dev:website`, open the printed URL, scroll to the fourth section. Expected: heading "Nothing is stored." followed by the muted-gray explanatory paragraph, narrower measure than the full section width (max 720px).

- [ ] **Step 5: Verify typecheck passes**

Run: `npm run typecheck:website`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/sections/Trust.tsx apps/website/src/App.tsx apps/website/src/styles/global.css
git commit -m "feat(website): add trust/privacy section"
```

---

### Task 10: SDK pitch section

**Files:**
- Create: `apps/website/src/sections/SdkPitch.tsx`
- Modify: `apps/website/src/App.tsx`
- Modify: `apps/website/src/styles/global.css`

**Interfaces:**
- Consumes: `.section` base class from Task 2. This section's `id="sdk"` is the anchor target for `Hero.tsx`'s CTA (`href="#sdk"`, already wired in Task 3).
- Produces: `SdkPitch` component consumed by `App.tsx`.

- [ ] **Step 1: Create SdkPitch.tsx**

```tsx
const SNIPPET = `import { configureRentgen } from '@rentgen/sdk';

configureRentgen({
  openaiApiKey: import.meta.env.VITE_OPENAI_API_KEY,
  tavilyApiKey: import.meta.env.VITE_TAVILY_API_KEY,
});

// mount anywhere — React, Angular, or plain HTML
<rentgen-scanner></rentgen-scanner>
<rentgen-results></rentgen-results>`;

export function SdkPitch() {
  return (
    <section className="section sdk-pitch" id="sdk" aria-labelledby="sdk-heading">
      <h2 id="sdk-heading">Built as an SDK, not a silo.</h2>
      <p>
        Rentgen drops into any platform as web components — React, Angular, or plain HTML, unchanged. Give
        dead listings a second life: identify, price, and let users cash in, right inside your product.
      </p>
      <pre className="sdk-pitch__snippet">
        <code>{SNIPPET}</code>
      </pre>
    </section>
  );
}
```

- [ ] **Step 2: Wire SdkPitch into App.tsx**

```tsx
import { Hero } from './sections/Hero';
import { Problem } from './sections/Problem';
import { HowItWorks } from './sections/HowItWorks';
import { Trust } from './sections/Trust';
import { SdkPitch } from './sections/SdkPitch';

export function App() {
  return (
    <>
      <Hero />
      <Problem />
      <HowItWorks />
      <Trust />
      <SdkPitch />
    </>
  );
}
```

- [ ] **Step 3: Append SDK pitch styles to global.css**

Append to `apps/website/src/styles/global.css`:

```css
.sdk-pitch p {
  color: var(--color-muted-fg);
  max-width: 720px;
}

.sdk-pitch__snippet {
  background: var(--color-card);
  border: 1px solid var(--color-muted-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  overflow-x: auto;
  font-size: 0.875rem;
  line-height: 1.6;
}

.sdk-pitch__snippet code {
  font-family: 'Fira Code', ui-monospace, monospace;
  color: var(--color-fg);
  white-space: pre;
}
```

- [ ] **Step 4: Verify visually**

Run: `npm run dev:website`, open the printed URL, scroll to the fifth section, and click the hero's "Try the scan" button. Expected: the page scrolls smoothly to this section (confirming the `#sdk` anchor works); a dark code block shows the `configureRentgen` snippet with monospaced text, scrollable horizontally on narrow viewports rather than wrapping/overflowing the page.

- [ ] **Step 5: Verify typecheck passes**

Run: `npm run typecheck:website`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/sections/SdkPitch.tsx apps/website/src/App.tsx apps/website/src/styles/global.css
git commit -m "feat(website): add SDK pitch section with code snippet"
```

---

### Task 11: Final CTA + footer

**Files:**
- Create: `apps/website/src/sections/FinalCta.tsx`
- Create: `apps/website/src/sections/Footer.tsx`
- Modify: `apps/website/src/App.tsx`
- Modify: `apps/website/src/styles/global.css`

**Interfaces:**
- Consumes: `.section` base class from Task 2, `.hero__cta` styling pattern from Task 3 (reused for the final CTA button).
- Produces: `FinalCta` and `Footer` components consumed by `App.tsx`.

- [ ] **Step 1: Create FinalCta.tsx**

```tsx
export function FinalCta() {
  return (
    <section className="section final-cta" aria-labelledby="final-cta-heading">
      <h2 id="final-cta-heading">Ready to see what your room is hiding?</h2>
      <a className="final-cta__button" href="#sdk">
        Try the scan
      </a>
    </section>
  );
}
```

- [ ] **Step 2: Create Footer.tsx**

```tsx
export function Footer() {
  return (
    <footer className="footer">
      <span className="footer__brand">Rentgen</span>
      <a className="footer__link" href="#sdk">
        Built with @rentgen/sdk
      </a>
    </footer>
  );
}
```

- [ ] **Step 3: Wire both into App.tsx**

```tsx
import { Hero } from './sections/Hero';
import { Problem } from './sections/Problem';
import { HowItWorks } from './sections/HowItWorks';
import { Trust } from './sections/Trust';
import { SdkPitch } from './sections/SdkPitch';
import { FinalCta } from './sections/FinalCta';
import { Footer } from './sections/Footer';

export function App() {
  return (
    <>
      <Hero />
      <Problem />
      <HowItWorks />
      <Trust />
      <SdkPitch />
      <FinalCta />
      <Footer />
    </>
  );
}
```

- [ ] **Step 4: Append final-cta + footer styles to global.css**

Append to `apps/website/src/styles/global.css`:

```css
.final-cta {
  align-items: center;
  text-align: center;
}

.final-cta__button {
  padding: var(--space-3) var(--space-6);
  background: var(--color-accent);
  color: var(--color-bg);
  font-weight: 600;
  border-radius: var(--radius-md);
  text-decoration: none;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}

.footer {
  max-width: 960px;
  margin: 0 auto;
  padding: var(--space-5) var(--space-4) var(--space-6);
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--color-muted-fg);
  font-size: 0.875rem;
  border-top: 1px solid var(--color-muted-border);
}

.footer__link {
  color: var(--color-muted-fg);
  text-decoration: underline;
}
```

- [ ] **Step 5: Verify visually**

Run: `npm run dev:website`, open the printed URL, scroll to the bottom. Expected: a centered heading "Ready to see what your room is hiding?" with a green CTA button, followed by a footer with "Rentgen" on the left and an underlined "Built with @rentgen/sdk" link on the right; clicking the footer link scrolls back up to the SDK section.

- [ ] **Step 6: Verify typecheck passes**

Run: `npm run typecheck:website`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add apps/website/src/sections/FinalCta.tsx apps/website/src/sections/Footer.tsx apps/website/src/App.tsx apps/website/src/styles/global.css
git commit -m "feat(website): add final CTA and footer"
```

---

### Task 12: Full-page verification and build

**Files:**
- Modify: `apps/website/src/styles/global.css` (only if the manual check below finds a spacing/overflow issue — see Step 3)

**Interfaces:**
- Consumes: the complete `App.tsx` assembled across Tasks 1–11.
- Produces: nothing new — this is the Definition-of-Done gate for the whole workspace.

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck:website`
Expected: exits 0.

- [ ] **Step 2: Run the production build**

Run: `npm run build:website`
Expected: exits 0, prints a `apps/website/dist` output summary with no errors or warnings about unused exports.

- [ ] **Step 3: Full manual smoke test**

Run: `npm run dev:website`, open the printed URL, and check each of the following. Fix any CSS issues found directly in `apps/website/src/styles/global.css` before proceeding (e.g. an unexpected horizontal scrollbar means a section is exceeding `100vw` — find and constrain the offending element):

- Resize the browser to 375px wide: confirm no horizontal scrollbar appears anywhere on the page, and the hero counter sits above the reveal canvas.
- Resize to 1440px wide: confirm the hero counter sits to the right of the reveal canvas, and content sections stay capped at a readable max width rather than stretching edge-to-edge.
- Tab through the page with the keyboard only, starting from the address bar: confirm a visible focus ring appears on the hero CTA, the x-ray slider handle, the SDK-section anchor link, the final CTA, and the footer link, in that visual order.
- With the x-ray handle focused, confirm arrow keys still move it and the counter/items update accordingly (regression check on Task 3's keyboard path after all later sections were added).
- Re-enable `prefers-reduced-motion` emulation (DevTools Rendering tab) and hard-reload: confirm the hero starts static at 0% (no auto-sweep) and item pop-ins appear as instant fades rather than springy scale animations.

- [ ] **Step 4: Verify the root workspace scripts are untouched**

Run: `npm run typecheck` and `npm run build` from the repo root.
Expected: both still succeed exactly as before this plan started (they only ever touch `@rentgen/sdk` and `apps/app`) — confirms `apps/website` did not interfere with the existing app.

- [ ] **Step 5: Commit (only if Step 3 required a fix)**

```bash
git add apps/website/src/styles/global.css
git commit -m "fix(website): resolve responsive/accessibility issues from full-page smoke test"
```

If Step 3 found no issues, skip this commit — there is nothing to commit.
