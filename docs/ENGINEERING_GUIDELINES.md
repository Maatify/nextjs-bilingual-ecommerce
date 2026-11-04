# Engineering guidelines

The rules every change in this repository follows. Each section points at the file or check that enforces it.

## Design tokens

- Colours, fonts, radii, shadows and easing live in the `@theme` block of `src/app/globals.css`. Use the tokens
  (`bg-surface`, `text-ink-2`, `text-forest`, `shadow-lift`, `ease-out-soft`…), not raw hex values or ad-hoc shadows.
- Three type families: `--font-sans` (Plus Jakarta Sans) for body, `--font-display` (Anton) for the poster headings and
  the wordmark, `--font-serif` (Instrument Serif) for accents. Arabic pages swap in Cairo (`src/app/fonts.ts`).
- Storefront and admin CSS are separate. `src/app/store.css` is the storefront stylesheet (globals minus the
  admin-only utilities); the dashboard imports `globals.css` and styles itself under `.admin[data-theme]`.
- The admin has its own font (`--font-admin`, Geist) and its own light/dark palette; don't reuse storefront tints there.

## Responsive layout

- Use logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`) so every layout mirrors
  correctly in Arabic (RTL). Physical `left`/`right` only for things that must not flip (the Latin wordmark, charts).
- Every page must work from 280 px to 3840 px wide with no horizontal page scroll and exactly one `h1`.
  `tests/e2e/layout.spec.ts` sweeps 280–3840 px in both languages and fails on either.
- Prefer fluid sizing (`clamp()`, grid `minmax`, `flex-wrap`) to extra breakpoints. Rows that can run out of room on
  a 280 px phone must wrap rather than overflow.
- Wrap phone numbers, order numbers, codes and prices in an LTR isolate inside Arabic text.

## Motion

- Use the `motion` library (`motion/react`) for component transitions and CSS transitions/keyframes for the rest.
- Animate `transform` and `opacity` only. No layout-triggering properties (`width`, `height`, `top`, `margin`).
- Respect `prefers-reduced-motion`: CSS animations are disabled under the `@media (prefers-reduced-motion: reduce)`
  blocks in `globals.css`, and components read `useReducedMotion()` before animating.
- Decorative motion (marquee, curtain, ripples) never blocks content or input, and never runs before first paint.

## Micro-interactions

- Pressable elements get the `fx-press` class (press depth + pointer ripple from `src/components/fx/runtime.tsx`);
  primary CTAs may add the `magnetic` hover lift from `src/components/fx/press.tsx`.
- Every button and link has visible hover, active and `:focus-visible` states.
- Async actions show a pending state on the control itself and a toast on success or failure.
- Pointer-only effects are gated on `(hover: hover) and (pointer: fine)` and stay off on touch.

## Accessibility

- Target WCAG 2.1 AA. `scripts/site-check.mjs` runs axe-core (wcag2a, wcag2aa, wcag21a, wcag21aa) on every key page
  and fails on serious or critical violations.
- One `h1` per page; headings in order; landmarks (`header`, `nav`, `main`, `footer`) on every layout.
- Every control has an accessible name: a visible label, `aria-label`, or a `label` element. Icon-only buttons always
  carry `aria-label`.
- Text and UI contrast at least 4.5:1 (3:1 for large text and icons). Never rely on colour alone for state.
- Dialogs and drawers trap focus, close on Escape and return focus to the opener.

## Images

- Use `next/image` with the custom loader in `src/lib/image-loader.ts` (pre-encoded WebP widths for `/p/` photos).
- Always pass `sizes` that match the rendered width, so phones never download desktop files.
- The LCP image of each page loads eagerly with `fetchPriority="high"`; everything else is lazy.
- New photos go through `npm run optimize:images` (`scripts/optimize-images.mjs`): an output is accepted only when its
  SSIMULACRA2 score against the original is at least 90.
- Every content image has meaningful `alt` text; decorative images use `alt=""`.

## Performance

- Storefront pages are statically prerendered; data comes from the store snapshot, not per-request queries.
- Budgets (checked by `scripts/site-check.mjs`): first-load JS at most 300 KB gzipped per page, every image in
  `public/` at most 300 KB.
- Lighthouse CI (`lighthouserc.json`) runs on the home, collection, product and cart pages.
- No new runtime dependency without measuring its size first; load heavy, below-the-fold UI with dynamic imports.

## Pre-merge checklist

- [ ] `npm run check` (lint, typecheck, unit tests, production build)
- [ ] `npm run test:smoke`
- [ ] `npm run test:site` (axe, SEO and budgets)
- [ ] `npm run test:e2e` (Playwright, including the layout sweep)
- [ ] `npm run security:check`
- [ ] `npm run lighthouse`
