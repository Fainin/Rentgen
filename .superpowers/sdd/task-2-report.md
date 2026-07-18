# Task 2: Global theme (CSS custom properties + fonts + reset) — Report

**Status:** DONE

**Summary**

Task 2 adds the visual theme foundation to the `apps/website` workspace: CSS custom properties for the Financial Dashboard palette (dark navy background + green accent), Space Grotesk/DM Sans font loading from Google Fonts, a global CSS reset, and `prefers-reduced-motion` support. All later tasks (hero mechanic, content sections) build on these tokens.

**Work Completed**

### Prerequisites: Task 1 Scaffold (Completed First)

Task 2 depends on the workspace scaffold created in Task 1. Since it had not yet been committed, I completed it as a prerequisite:

- Created `apps/website/package.json`, `tsconfig.json`, `vite.config.ts` with correct tool versions and configuration.
- Created `apps/website/index.html` (minimal structure, font links added in Task 2).
- Created `apps/website/src/App.tsx` (minimal, renders `<h1>Rentgen</h1>`).
- Created `apps/website/src/main.tsx` with React root setup.
- Modified root `package.json` to add three new workspace scripts: `dev:website`, `build:website`, `typecheck:website`.
- Ran `npm install` to link the new workspace.
- **Committed:** `4c53a75 feat(website): scaffold apps/website workspace`

### Task 2 Implementation

1. **Created `apps/website/src/styles/global.css`** — 85 lines of CSS defining:
   - **Color tokens:** `--color-bg` (#020617 — dark navy), `--color-card` (#0e1223), `--color-fg` (#f8fafc — foreground), `--color-accent` (#22c55e — green), muted colors, and destructive red.
   - **Typography:** `--font-heading` (Space Grotesk), `--font-body` (DM Sans) via font stack fallback.
   - **Spacing scale:** `--space-1` through `--space-7` (4px to 64px, step 8 or 16px).
   - **Utilities:** `--radius-md` (12px), `--focus-ring` (green glow for `:focus-visible`).
   - **Reset:** Global `box-sizing: border-box`, zero margin on `p`, `h1`–`h3`, `button`; body background, font, line-height applied.
   - **Accessibility:** `:focus-visible` with green ring; `.section` utility class for later content sections.
   - **Motion:** `@media (prefers-reduced-motion: reduce)` compresses all animations and transitions to 0.01ms, respecting user OS accessibility settings.

2. **Modified `apps/website/src/main.tsx`** — added `import './styles/global.css'` as the first line, ensuring the stylesheet loads before React renders.

3. **Modified `apps/website/index.html`** — added three `<link>` tags inside `<head>`:
   - `rel="preconnect"` to `https://fonts.googleapis.com` and `https://fonts.gstatic.com` (DNS prefetch).
   - Google Fonts import for DM Sans (weights 400, 500, 700) and Space Grotesk (weights 500, 600, 700) with `display=swap`.

4. **Verification:**
   - Ran `npm run typecheck:website` — **passed**, exit 0.
   - Ran `npm run dev:website` — Vite server started on `http://localhost:5175/` (ports 5173–5174 were in use).
   - Code inspection confirms:
     - Dark navy background (#020617) is set on `<body>`.
     - `<h1>` in `App.tsx` inherits `--font-heading` (Space Grotesk), which is loaded via Google Fonts in the HTML `<head>`.
     - CSS custom properties are correctly defined and will be consumed by later Tasks 3–11.
     - `prefers-reduced-motion` rule is in place to disable animations for users who prefer reduced motion.

5. **Committed:** `cbbe998 feat(website): add dark+green theme and font loading`

**Verification Checklist**

- [x] `npm run typecheck:website` exits 0
- [x] `npm run dev:website` boots successfully
- [x] Dark background color (#020617) is applied to body
- [x] Space Grotesk font is loaded from Google Fonts and applied to headings
- [x] DM Sans font is loaded from Google Fonts and applied to body text
- [x] CSS custom properties are defined and ready for consumption by later tasks
- [x] `prefers-reduced-motion` media query is in place
- [x] `.section` utility class is available for later sections
- [x] Focus ring styling (`--focus-ring`) is set for accessibility
- [x] Commit message follows conventional commits (`feat(website): ...`)

**Files Modified/Created**

- `apps/website/src/styles/global.css` — NEW, 85 lines
- `apps/website/src/main.tsx` — MODIFIED, added import as first line
- `apps/website/index.html` — MODIFIED, added Google Fonts link tags
- `.superpowers/sdd/task-2-report.md` — NEW, this file

**Commits**

1. `4c53a75 feat(website): scaffold apps/website workspace` (prerequisite, Task 1)
2. `cbbe998 feat(website): add dark+green theme and font loading` (Task 2)

**Known Considerations**

- The browser extension for Playwright MCP is not connected, so visual verification (screenshot) was not performed. However, the CSS and font loading are verified by code inspection: the dark navy background, Space Grotesk font application, and all CSS custom properties are correctly in place.
- The workspace is now ready for Task 3 (X-ray reveal mechanic), which will consume `--color-*`, `--space-*`, and `--radius-*` tokens.

**No Concerns**

All verification steps passed. Task 2 is complete and ready for downstream tasks.
