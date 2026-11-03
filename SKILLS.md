# Skills used to build this store

These are the eight working guidelines ("skills") followed for every change in this project: design quality, responsive layout, motion, micro-interactions, accessibility, images, performance and the pre-ship review. They are collected here in one file so anyone can read or reuse them.

## Contents

- [premium-ui](#premium-ui)
- [responsive-layout](#responsive-layout)
- [ui-animation](#ui-animation)
- [micro-interactions](#micro-interactions)
- [accessibility](#accessibility)
- [image-optimization](#image-optimization)
- [performance](#performance)
- [website-review](#website-review)

---

## premium-ui

> Design and implement interfaces with the visual quality bar of Apple, Stripe, Linear, Vercel, Notion, and Raycast: generous whitespace, restrained type scales, precise spacing rhythm, subtle depth, and clear visual hierarchy. Use when: "make this look premium/polished", "make it feel like Stripe/Linear/Apple", "this looks like a generic template", "improve the visual design", or when building a new section/page with no existing design system to follow. NOT for: pixel-matching an existing Figma file (use figma-pixel-perfect), motion/animation (use ui-animation), accessibility (use accessibility).

### Premium UI

Produce interfaces that read as considered and expensive, not as a
default component-library scaffold with a color swapped in.

#### Objective

Given a section, page, or component with no strict external design
spec, make design decisions (spacing, type, color, elevation,
hierarchy) that match the quality bar of best-in-class product UI —
Apple, Stripe, Linear, Vercel, Notion, Raycast — rather than
defaulting to generic, evenly-padded, center-everything template
design.

#### Scope

- New UI where the user wants "polish" or "premium feel" and has not
  supplied a pixel-spec design.
- Improving an existing but visually flat/generic implementation.
- Does not override an actual Figma spec — if one exists, follow
  `figma-pixel-perfect` instead; this skill fills the gap when there
  isn't one.

#### Rules

1. **Whitespace is a material, not a leftover.** Generous, deliberate
   spacing around content is the single highest-leverage move toward
   "premium." Default to more breathing room than feels natural, then
   pull back only if it reads empty rather than calm.
2. **One accent color, used sparingly.** Premium interfaces are
   dominated by neutrals (near-black text, grays, off-white/near-black
   backgrounds) with a single brand/accent color reserved for the 1-2
   things that most need attention (primary CTA, active state, key
   data point) — not sprinkled across every icon and border.
3. **Type scale, not type soup.** Pick a small, deliberate set of
   sizes/weights (e.g. 4-6 steps) and reuse them everywhere. Never
   introduce a one-off font-size for a single element.
4. **Hierarchy through contrast, not decoration.** Establish what
   matters most on a screen via size, weight, and color contrast —
   not borders, boxes, or background fills around every section.
   If removing a border/shadow doesn't hurt comprehension, remove it.
5. **Depth is subtle.** Shadows are soft, low-opacity, and used to
   suggest elevation (a card above a background), not to decorate.
   Prefer `0 Npx Mpx rgba(0,0,0,0.04–0.12)` ranges over hard,
   saturated shadows. Avoid stacking multiple heavy shadows.
6. **Borders are quiet.** 1px, low-contrast (e.g. 8-12% opacity
   against the background), used to separate, not to frame
   decoratively.
7. **Corners are consistent.** Pick a radius scale (e.g. 8/12/16/24px)
   and apply it systematically — small radius for controls/inputs,
   larger for cards/modals — never a random assortment per component.
8. **Alignment is exact.** Nothing should be "close enough" — icons
   optically centered (not just geometrically), baselines aligned,
   consistent left edges down a column. Misalignment is the fastest
   way to look amateur regardless of color/spacing choices.
9. **Motion (if present) is restrained.** Defer actual animation
   detail to `ui-animation`, but the default bias here is: subtle,
   fast (150-300ms), and purposeful — never a bouncy/playful default
   unless the brand explicitly calls for it.
10. **Real content over lorem ipsum.** Premium UI is validated against
    realistic content lengths (long names, empty states, overflow)
    — design that only works for the happy-path demo string isn't
    premium, it's a screenshot.

#### Constraints

- Never introduce a new font, icon set, or component library without
  checking what the project already uses — premium UI reuses the
  existing system precisely, it doesn't fragment it.
- Don't add gradients, glassmorphism, or heavy shadows as a default
  "premium" signifier — those read premium only in specific contexts
  (2020s SaaS marketing sites) and read dated or gimmicky elsewhere.
  Match the reference brands' actual current restraint, not a dated
  stereotype of "premium."
- Respect existing brand color tokens — "premium" is achieved through
  restraint and precision applied to the existing palette, not by
  replacing brand colors with generic neutrals.

#### Workflow

1. **Identify the real hierarchy.** Before touching visuals, list
   what the user must see first, second, third on this
   screen/section. If this isn't obvious from the content, ask or
   infer from the surrounding page's intent.
2. **Audit current spacing.** Look for inconsistent gaps, cramped
   text, or elements touching edges with no margin. These are the
   fastest wins.
3. **Reduce before you add.** Remove unnecessary borders, background
   fills, icons, and decorative elements first. Premium is
   subtractive far more often than additive.
4. **Apply a consistent spacing scale** (e.g. 4/8/12/16/24/32/48/64/96px
   or the project's existing scale) — never a one-off pixel value
   picked by eye.
5. **Apply a consistent type scale** and confirm line-height and
   letter-spacing read comfortably at each size (larger sizes usually
   need tighter letter-spacing and tighter line-height; small
   sizes need the opposite).
6. **Set one accent moment per view.** Identify the single most
   important interactive element and make it the only saturated-color
   element in the immediate area.
7. **Check alignment at the pixel level** — verify icon optical
   centers, consistent left-edges, consistent vertical rhythm between
   sections.
8. **Stress-test with real content** — long strings, empty states,
   many items, few items — before calling it done.
9. **Step back and compare** against the actual reference product (a
   real Stripe/Linear screen), not a memory of what "premium" looks
   like — get specific about what's different.

#### Examples

**Generic → Premium: a pricing card**

Generic: colored border, drop shadow on every card, icon + heading +
paragraph all centered, CTA button same weight as secondary link,
tight 12px internal padding.

Premium: no border (or 1px at 8% opacity), no shadow at rest (shadow
only appears as a hover/elevation cue if the card is interactive),
left-aligned content (center-alignment is used sparingly, mostly for
short marketing headlines, not for card bodies with paragraphs),
primary CTA is the only saturated-color element on the card, 32-40px
internal padding, price is the largest/heaviest text on the card by a
clear margin over everything else.

**Generic → Premium: a settings page**

Generic: every row wrapped in its own bordered box, all text is the
same gray, icons in a rainbow of colors.

Premium: rows separated by a single hairline divider (not individual
boxes), label text is near-black/high-contrast while helper text is
a lighter gray (clear two-tier hierarchy), icons are monochrome
(matching text color, not decorative color), consistent 56-64px row
height, generous horizontal padding to the container edge.

#### Common Mistakes

- Adding a shadow, gradient, or border "to make it pop" when removing
  a neighboring element would achieve more hierarchy.
- Using 3+ accent colors because "the brand has a palette" — a
  palette existing doesn't mean every screen should use all of it.
- Centering body text/paragraphs (reads as a poster, not a product).
- Uniform gray text everywhere, with no contrast tier between
  primary and secondary content.
- Copy-pasting a component's padding value from a different
  component instead of deriving it from the spacing scale.
- Chasing a trend (skeuomorphism, heavy glassmorphism, neubrutalism)
  because it's visible somewhere online, without checking it matches
  the project's actual brand and content type.

#### Best Practices

- When in doubt, default to *less* decoration and *more* space.
- Look at the actual current design of the named reference product
  (Stripe.com, linear.app, vercel.com, notion.so, raycast.com) for
  the specific pattern being built, rather than a general impression
  of "clean SaaS design."
- Keep a running mental (or literal) style summary — spacing scale,
  type scale, radius scale, the one accent color — and check new
  components against it instead of deciding fresh each time.
- Prefer adjusting existing Tailwind/design-token values over
  introducing new arbitrary ones — consistency compounds.

#### Anti-patterns

- ❌ A card for every piece of content, each with its own shadow and
  border, regardless of whether grouping is meaningful.
- ❌ Rainbow icon colors used purely for "visual interest."
- ❌ A different border-radius on every component in the same view.
- ❌ Filling empty space with decorative elements instead of leaving
  it empty.
- ❌ Centering everything by default because it's the easiest flex
  alignment to reach for.

#### Checklist

- [ ] Clear visual hierarchy: what matters most is unambiguous at a
      glance
- [ ] Spacing pulled from a consistent scale, generous by default
- [ ] Type scale limited to a handful of deliberate steps
- [ ] Exactly one accent color doing meaningful work per view
- [ ] Shadows/borders subtle, used to separate, not decorate
- [ ] Border radius consistent across similar element types
- [ ] Alignment verified at the pixel level, not just "looks aligned"
- [ ] Tested against realistic content (long strings, empty states)
- [ ] No new dependencies (fonts/icons/libraries) introduced without
      checking existing project conventions

#### Success Criteria

- A side-by-side against the named reference product's equivalent
  screen shows comparable restraint and hierarchy, not just "also
  has rounded corners."
- Removing any single decorative element doesn't improve the design
  — meaning nothing unnecessary was left in.
- The design holds up with real, messy content — not just the happy
  path.

### premium-ui: examples

#### Example 1 — Navbar

**Generic:**
```html
<nav style="background:white; border-bottom:2px solid #e5e5e5; box-shadow:0 2px 8px rgba(0,0,0,0.15); padding:12px 16px;">
  <div style="display:flex; justify-content:space-between;">
    <img src="logo.svg" style="height:40px" />
    <div style="display:flex; gap:12px;">
      <a style="color:#3b82f6;">Home</a>
      <a style="color:#3b82f6;">About</a>
      <a style="color:#3b82f6;">Contact</a>
    </div>
  </div>
</nav>
```
Every link is the accent color, the shadow is heavy, the border is
high-contrast.

**Premium:**
```html
<nav class="border-b border-black/[0.06] px-6 py-4 md:px-10">
  <div class="mx-auto flex max-w-6xl items-center justify-between">
    <img src="logo.svg" class="h-7" />
    <div class="flex items-center gap-8 text-sm text-neutral-600">
      <a class="hover:text-neutral-950 transition-colors">Home</a>
      <a class="hover:text-neutral-950 transition-colors">About</a>
      <a class="text-neutral-950 font-medium">Contact</a> <!-- active state gets weight/contrast, not color -->
    </div>
  </div>
</nav>
```
Neutral text by default, hairline border, no shadow, the "active"
state is communicated with weight and contrast rather than a
different color for every link.

---

#### Example 2 — Stat/metric card

**Generic:**
```html
<div style="border:2px solid #d1d5db; border-radius:8px; box-shadow:0 4px 6px rgba(0,0,0,0.1); padding:16px; text-align:center;">
  <div style="color:#8b5cf6; font-size:14px;">Total Revenue</div>
  <div style="color:#111; font-size:24px; font-weight:bold;">$48,231</div>
  <div style="color:#10b981; font-size:12px;">+12.4%</div>
</div>
```

**Premium:**
```html
<div class="p-6">
  <div class="text-sm text-neutral-500">Total Revenue</div>
  <div class="mt-1 text-3xl font-semibold tracking-tight text-neutral-950">$48,231</div>
  <div class="mt-1 text-sm text-emerald-600">+12.4% from last month</div>
</div>
```
No border, no shadow, no box at all — the number's size and weight
alone establish it as the important element. Spacing between label,
value, and delta is deliberate, not centered/cramped.

---

#### Example 3 — Empty state

**Generic:**
```html
<div style="text-align:center; padding:40px; background:#f3f4f6; border-radius:8px;">
  <div style="font-size:48px;">📭</div>
  <h3>No items found</h3>
  <p style="color:#666;">Try adding your first item</p>
  <button style="background:#3b82f6; color:white; padding:8px 16px; border-radius:4px;">Add Item</button>
</div>
```

**Premium:**
```html
<div class="flex flex-col items-center gap-3 py-24 text-center">
  <h3 class="text-base font-medium text-neutral-900">No items yet</h3>
  <p class="max-w-xs text-sm text-neutral-500">
    Items you add will show up here. Get started with your first one.
  </p>
  <button class="mt-3 rounded-lg bg-neutral-950 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition-colors">
    Add item
  </button>
</div>
```
No background fill, no emoji-as-icon, generous vertical space, the
button uses the interface's ink color rather than a separate "brand
blue" that competes with the primary accent used elsewhere.

---

#### Example 4 — Form field

**Generic:**
```html
<label style="color:#374151; font-weight:bold;">Email Address</label>
<input style="border:2px solid #9ca3af; border-radius:4px; padding:10px; width:100%;" />
<span style="color:#ef4444; font-size:11px;">* Required field</span>
```

**Premium:**
```html
<label class="text-sm font-medium text-neutral-800">Email</label>
<input class="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm
              placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none
              focus:ring-2 focus:ring-neutral-950/5" placeholder="you@example.com" />
```
Lighter border weight, no shouty asterisk/required styling (validation
messaging is contextual, appears on blur/submit, not permanently
displayed), focus state uses a soft ring rather than a hard color
change.

---

## responsive-layout

> Build layouts that adapt fluidly across all screen sizes using clamp(), CSS Grid, Flexbox, Container Queries, and fluid spacing — instead of a fixed set of pixel breakpoints that break at in-between widths. Use when: "make this responsive", "this breaks on mobile/tablet", "fix this layout on small screens", "make this work on all devices", building any new multi-breakpoint UI. NOT for: pixel-matching a single fixed-width Figma frame with no responsive spec (see figma-pixel-perfect, then apply this skill for the gaps Figma doesn't define).

### Responsive Layout

Build layouts that hold up at every viewport width — not just the
2-3 breakpoints that were explicitly tested.

#### Objective

Produce layouts using modern CSS (fluid `clamp()`-based sizing,
Grid, Flexbox, Container Queries) that degrade gracefully across the
entire viewport range, avoid fixed pixel breakpoints as the only
adaptation mechanism, and never visually break (overlap, overflow,
unreadable text, horizontal scroll) at any width between the tested
breakpoints.

#### Scope

- Any layout, component, or page that must render correctly across
  more than one viewport size (i.e. nearly everything on the web).
- Covers spacing/type fluidity, grid/flex structure, container
  queries for component-level responsiveness, and breakpoint
  strategy.
- Does not cover Figma-sourced fixed dimensions themselves (see
  `figma-pixel-perfect`) — this skill governs the *in-between* and
  *beyond-the-frame* behavior Figma often doesn't specify.

#### Rules

1. **Prefer fluid values over breakpoint-jumping ones.** Use
   `clamp(min, preferred, max)` for font sizes, spacing, and
   dimensions that should scale smoothly with viewport width, instead
   of a fixed value that jumps at each breakpoint.
   `font-size: clamp(1.5rem, 1rem + 2vw, 3rem)` scales continuously;
   `text-2xl md:text-4xl lg:text-6xl` jumps in three discrete steps
   and can look mismatched at widths between them.
2. **Use Grid for two-dimensional layout, Flexbox for one.** Don't
   force a Grid where a simple row/column Flexbox suffices, and don't
   fight Flexbox to build something that's actually a grid (card
   grids, dashboards, form layouts with aligned columns).
3. **Container Queries for component-level responsiveness.** When a
   component's layout should respond to the width of its own
   container (e.g. a card that's sometimes in a wide sidebar,
   sometimes in a narrow one) rather than the viewport, use
   `@container` — don't fake it with viewport breakpoints that only
   happen to correlate with container width in one specific layout.
4. **Never hardcode a fixed pixel width on anything that must remain
   flexible.** A fixed-width container should have a `max-width`,
   not a `width`, unless it is genuinely meant to never resize (e.g.
   an icon).
5. **Test the gaps, not just the breakpoints.** A layout that looks
   fine at exactly 375px, 768px, and 1440px but breaks at 900px or
   600px has failed — verify at arbitrary widths, not only the named
   breakpoint values.
6. **Text must never overflow its container or get clipped.** Long
   words, long names, and localized (often longer) strings must wrap
   or truncate deliberately (`text-wrap: balance`/`pretty`,
   `overflow-wrap`, `line-clamp`), never spill out or get silently
   cut off mid-character.
7. **Never rely on a fixed viewport height assumption.** Avoid
   `height: 100vh` for content that must remain scrollable/accessible
   when content exceeds the viewport, and account for mobile browser
   chrome (use `100dvh` over `100vh` when true dynamic viewport
   height is needed).
8. **Images and media scale within their container** (`max-width:
   100%`, `height: auto`, or an explicit `aspect-ratio`) — never allowed
   to overflow or distort.
9. **Horizontal scroll on the page body is always a bug**, except for
   an intentionally designed horizontally-scrolling region (carousel,
   gallery) which must be deliberately contained
   (`overflow-x: auto` on that specific element, not inherited
   accidentally by the page).
10. **Touch targets stay usable on small screens** — interactive
    elements should not shrink below a comfortably tappable size
    (~44×44px) purely because the layout got tighter.

#### Constraints

- Don't introduce Container Queries support requirements if the
  project must support browsers that predate it — check the
  project's actual browser support target first (rare to be an issue
  in 2025+ but verify rather than assume).
- Fluid `clamp()` values need sane min/max bounds — text must never
  clamp so small it's illegible on tiny screens, nor so large it
  breaks layout on ultra-wide screens.
- Don't replace every fixed breakpoint with `clamp()` reflexively —
  some layout *structure* changes (e.g. sidebar becomes a bottom
  sheet, nav becomes a hamburger menu) are genuinely discrete and
  belong at a breakpoint, not a fluid interpolation.

#### Workflow

1. **Classify each responsive concern**: is it a *value* that should
   scale continuously (font size, padding, gap) or a *structure*
   that should change discretely (nav layout, column count, card vs.
   list view)? Use `clamp()`/fluid units for the former, breakpoints
   for the latter.
2. **Choose the layout primitive**: Grid for multi-axis alignment,
   Flexbox for single-axis flow, Container Queries when the
   component's own width (not the viewport's) should drive its
   layout.
3. **Define fluid scales** for spacing and typography using
   `clamp()`, anchored to the project's existing design tokens where
   they exist (don't invent a parallel scale).
4. **Set breakpoints only where structure genuinely changes** —
   typically driven by content (when does this grid stop having room
   for N columns?) rather than specific device widths.
5. **Constrain media** — `max-width: 100%`, `height: auto` or
   `aspect-ratio`, on every image/video/embed.
6. **Handle text overflow explicitly** for any user-generated or
   variable-length content (names, titles, descriptions).
7. **Verify at the gaps**: resize continuously through the full
   range (or check specific in-between widths like 600, 900, 1024,
   1280px, not just standard breakpoint values) — nothing should
   overlap, clip, or force horizontal scroll.
8. **Verify with real/long content**, not just short demo strings —
   responsive bugs hide behind lorem-ipsum-length text.
9. **Check touch target sizes** on the smallest supported viewport.

#### Examples

**Fluid type instead of breakpoint jumps**
```css
h1 { font-size: clamp(1.75rem, 1.1rem + 2.8vw, 3.5rem); }
```
```html
<!-- Tailwind arbitrary-value equivalent -->
<h1 class="text-[clamp(1.75rem,1.1rem+2.8vw,3.5rem)]">
```

**Fluid spacing scale**
```css
.section { padding-block: clamp(2rem, 1rem + 4vw, 6rem); }
```

**Grid that reflows by available space, not a manual breakpoint list**
```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: clamp(1rem, 2vw, 2rem);
}
```
This adds/removes columns based on actual available width — no
`sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4` guessing needed, and
it doesn't break at widths between those guesses.

**Container query for a component reused in different contexts**
```css
.card-list { container-type: inline-size; }
@container (min-width: 480px) {
  .card { grid-template-columns: 120px 1fr; }
}
```

**Safe text truncation**
```css
.title { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
```

#### Common Mistakes

- Using only `sm:`/`md:`/`lg:` breakpoints for values that should
  scale continuously (type size, spacing), producing visible "jumps"
  at exact breakpoint widths.
- Fixed `width` (not `max-width`) on a content container, breaking
  on narrower viewports.
- `height: 100vh` on a mobile page, fighting with browser chrome
  (address bar show/hide) and clipping content.
- Testing only at 375/768/1440 and never checking in-between widths.
- Forgetting `max-width: 100%` on images inside flexible containers,
  causing overflow.
- Truncating text with fixed `width` + `overflow: hidden` with no
  `text-overflow: ellipsis`, silently clipping mid-character.
- Shrinking buttons/tap targets below ~44px on mobile to "fit" a
  cramped layout instead of restructuring it.

#### Best Practices

- Reach for `auto-fit`/`auto-fill` Grid patterns before manually
  enumerating column counts per breakpoint.
- Keep a single source of truth for the spacing/type scale (Tailwind
  config, CSS custom properties) and derive `clamp()` bounds from it,
  rather than picking fresh numbers per component.
- Use `dvh`/`svh`/`lvh` units instead of `vh` whenever mobile browser
  chrome could affect the intended height.
- Design mobile-first when starting from scratch — it's easier to
  add complexity for wider screens than to unwind cramped assumptions
  built for desktop first.

#### Anti-patterns

- ❌ A layout that only works correctly at exactly 1440px because it
  was only ever tested at that width.
- ❌ `overflow-x: hidden` on `body` as a blanket fix for a horizontal
  scroll bug instead of finding and fixing the overflowing element.
- ❌ Nesting `sm:`/`md:`/`lg:` variants 4-5 levels deep on a single
  element instead of restructuring with Grid `auto-fit` or a
  Container Query.
- ❌ A fixed-height card whose content silently overflows/clips at
  longer text lengths.

#### Checklist

- [ ] Values that should scale continuously use `clamp()`/fluid
      units, not only discrete breakpoints
- [ ] Grid used for multi-axis layout, Flexbox for single-axis
- [ ] Container Queries used where component width (not viewport)
      should drive layout
- [ ] No unintentional fixed pixel widths on flexible containers
- [ ] All media constrained (`max-width: 100%` + `aspect-ratio`/`height: auto`)
- [ ] Text overflow handled explicitly for variable-length content
- [ ] No accidental horizontal scroll on the page body
- [ ] Verified at in-between widths, not just named breakpoints
- [ ] Verified with realistic/long content
- [ ] Touch targets remain ≥~44px on small screens

#### Success Criteria

- The layout has no visual break (overlap, overflow, illegible text,
  unintended horizontal scroll) at any width from ~320px to ultra-wide.
- Resizing the browser window continuously shows smooth adaptation,
  not sudden jumps or breakage between tested breakpoints.
- Long/realistic content doesn't break the layout at any width.

### responsive-layout: examples

#### Example 1 — Fluid hero heading

**Breakpoint-jumping (avoid as the only mechanism):**
```html
<h1 class="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl">
```
Five discrete steps; looks mismatched at widths between them (e.g.
1279px vs 1280px is a visible jump).

**Fluid:**
```html
<h1 class="text-[clamp(1.875rem,1.2rem+3vw,4.5rem)]">
```
Scales continuously across the entire range. Combine with a max
container width so it doesn't grow unbounded on ultra-wide monitors.

---

#### Example 2 — Card grid without manual breakpoint columns

**Manual, brittle:**
```html
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
```
Works at the tested widths; at 900px (between `sm` and `lg`) you get
2 columns that might be too cramped, with no way to express "3 would
actually fit."

**Content-driven:**
```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: clamp(1rem, 2vw, 2rem);
}
```
The browser adds/removes columns based on actual available space —
correct at every width, not just the tested ones.

---

#### Example 3 — Container query for a reusable card

A `<ProductCard>` used both in a 3-column grid and a narrow sidebar
needs different internal layouts depending on *its own* width, not
the viewport's.

```css
.product-card { container-type: inline-size; }

.product-card .body { display: flex; flex-direction: column; gap: 0.5rem; }

@container (min-width: 360px) {
  .product-card .body { flex-direction: row; align-items: center; gap: 1rem; }
}
```
```html
<div class="product-card">
  <img src="..." class="w-full aspect-square object-cover" />
  <div class="body">
    <h3>Product name</h3>
    <p>$42.00</p>
  </div>
</div>
```
The same component automatically switches from stacked to
side-by-side based on the space it's actually given — correct in the
grid and in the sidebar without any viewport-based override.

---

#### Example 4 — Safe dynamic viewport height

**Breaks on mobile (address bar resize causes jump/clip):**
```css
.full-screen-hero { height: 100vh; }
```

**Correct:**
```css
.full-screen-hero { height: 100dvh; } /* dynamic viewport height */
```
Falls back gracefully in browsers without `dvh` support if paired
with a `100vh` declaration first:
```css
.full-screen-hero {
  height: 100vh;   /* fallback */
  height: 100dvh;  /* preferred, overrides in supporting browsers */
}
```

---

#### Example 5 — Truncating variable-length content safely

```css
.card-title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-wrap: pretty; /* avoids orphan words on the clamp line where supported */
}
```
Never rely on a fixed `height` + `overflow: hidden` alone — that
clips mid-line with no ellipsis and no indication text was cut.

---

#### Example 6 — Fluid section spacing tied to the design scale

```js
// tailwind.config — extend spacing with fluid tokens derived from
// the existing static scale, not arbitrary new numbers
theme: {
  extend: {
    spacing: {
      'section-y': 'clamp(3rem, 2rem + 4vw, 8rem)',
      'gutter': 'clamp(1rem, 0.5rem + 2vw, 4rem)',
    },
  },
}
```
```html
<section class="py-section-y px-gutter">
```
Keeps fluid values centralized and reusable instead of inlining a
fresh `clamp()` expression in every component.

---

## ui-animation

> Implement UI motion — hover interactions, stagger effects, page transitions, and scroll-triggered animations — using Framer Motion (motion/react), Motion One, or GSAP, matched to what the project already has installed, while keeping every animation at a smooth 60 FPS. Use when: "add animation", "animate this on scroll", "add a hover effect", "make this transition smoothly", "stagger these items in", "add a page transition". NOT for: static visual design (use premium-ui), one-off CSS-only micro feedback like button press states (use micro-interactions, though the two overlap and either may apply).

### UI Animation

Add motion that reads as intentional and smooth, using the
animation library the project already depends on (or the lightest
one that fits), never janky, never gratuitous.

#### Objective

Implement hover interactions, enter/exit transitions, scroll-linked
reveals, stagger sequences, and page transitions that run at a
consistent 60 FPS, use the correct tool for the job (CSS transitions
for simple state changes, Framer Motion/Motion One for
orchestration and gestures, GSAP for complex timelines/scroll
scrubbing), and never block the main thread or trigger layout thrash.

#### Scope

- Any request to add or improve motion on interactive or
  scroll-triggered UI.
- Covers library selection, animation composition (duration, easing,
  stagger, orchestration), and performance validation.
- Does not cover the underlying visual design being animated (see
  `premium-ui`) or accessibility of motion (see `accessibility` for
  `prefers-reduced-motion`, though this skill must still respect it).

#### Rules

1. **Animate only compositor-friendly properties by default:**
   `transform` (translate/scale/rotate) and `opacity`. Avoid
   animating `width`, `height`, `top`/`left`, `box-shadow` blur, or
   `filter` on anything that moves frequently or in bulk — these
   force layout/paint and drop frames. If a layout-affecting property
   must animate, use `layout` animations (Framer Motion's `layout`
   prop) which handle the FLIP technique correctly instead of raw
   CSS transitions on layout properties.
2. **Match the library to the job:**
   - Simple hover/focus state change on one element → CSS
     `transition` (no JS animation library needed at all).
   - Component enter/exit, shared layout transitions, gesture-driven
     interactions (drag, tap, hover with spring physics), React-idiomatic
     orchestration → Framer Motion (`motion/react`).
   - Lightweight, framework-agnostic, minimal-bundle animation
     without React-specific features → Motion One.
   - Complex timelines, scroll-scrubbing, SVG morphing, precise
     multi-step choreography beyond what declarative variants handle
     well → GSAP (+ ScrollTrigger).
   Do not reach for GSAP for a button hover, and do not hand-roll a
   scroll-scrubbed timeline in raw `useEffect` + `scrollY` listeners
   when GSAP ScrollTrigger already solves it correctly.
3. **Respect what's already installed.** Check `package.json` before
   adding a new animation dependency. Introducing a second animation
   library alongside an existing one is a last resort, not a default.
4. **Durations stay short and purposeful.** Micro-interactions:
   100-200ms. Element enter/exit: 200-400ms. Page transitions:
   300-500ms. Scroll-linked reveals: tie to scroll progress, not a
   fixed duration. Anything longer needs a specific justification
   (a hero moment), not a default.
5. **Easing is not linear**, except for continuous/looping motion
   (spinners) or scroll-scrubbed animation (which should track
   scroll position directly, not ease). Use `ease-out` for elements
   entering/responding to user action (feels immediate), `ease-in-out`
   for elements that both enter and exit the same way, spring physics
   for anything gesture-driven (drag, hover-follow) rather than
   fixed-duration easing curves.
6. **Stagger with intent.** A list of N items entering should use a
   small per-item delay (typically 30-80ms) capped at a reasonable
   total (don't stagger 50 items with 80ms each — cap the max total
   delay and reduce spacing as count grows, or batch/step it).
7. **Always honor `prefers-reduced-motion`.** Every non-trivial
   animation must have a reduced-motion fallback: either instant
   state change or a much-reduced-distance/duration variant. This is
   not optional polish — treat it as a hard requirement of shipping
   any animation.
8. **Animations must be interruptible.** A user hovering on/off
   rapidly, or navigating away mid-transition, must not cause visual
   jank, stuck states, or stacked/competing animations. Prefer
   libraries' built-in interrupt handling (Framer Motion handles this
   natively) over manual `setTimeout` state machines.
9. **Don't animate on every render.** Guard entrance animations so
   they run once (on mount / on scroll-into-view), not on every
   re-render of a parent component.

#### Constraints

- No animation may drop below 60 FPS on a mid-range device for its
  primary use case — test with more than 5-10 animating elements if
  the pattern will realistically appear in a list/grid.
- Scroll-linked animations must not attach unthrottled scroll
  listeners that run synchronous layout reads — use
  `IntersectionObserver` for enter/exit triggers and
  GSAP ScrollTrigger / Framer Motion's `useScroll` for scroll-scrubbed
  values, both of which are already optimized for this.
- Never disable/override a user's OS-level reduced-motion preference.

#### Workflow

1. **Classify the animation type**: state-change hover/focus,
   mount/unmount transition, orchestrated multi-element sequence,
   scroll-triggered reveal, scroll-scrubbed timeline, or gesture
   (drag/swipe).
2. **Pick the tool** per Rule 2, checking existing dependencies
   first (`grep` `package.json` for `framer-motion`, `motion`,
   `gsap`).
3. **Identify the properties to animate** — restrict to
   transform/opacity wherever possible (Rule 1); if layout properties
   seem necessary, check whether a `layout` animation or a
   transform-based trick (e.g. `scaleY` instead of `height`) achieves
   the same visual result more cheaply.
4. **Set duration and easing** per Rule 4/5, matched to the
   interaction's emotional weight (a delete confirmation should not
   have the same bouncy spring as a marketing hero).
5. **Implement the reduced-motion fallback** alongside the main
   implementation, not as an afterthought.
6. **Verify interruptibility** — rapidly trigger the animation
   on/off/on and confirm no stacking, jumping, or stuck end-states.
7. **Verify frame rate** — if browser devtools are available, check
   the Performance panel for the animation; otherwise reason about
   it via the properties animated (Rule 1 compliance is the main
   signal) and element count (stagger/list scenarios).
8. **Confirm no animation blocks interaction** — a page transition
   or entrance animation must never prevent the user from clicking
   through/scrolling during it, unless that's an explicit, brief,
   intentional design choice (e.g. a route transition overlay).

#### Examples

**Hover scale — CSS only, no library needed**
```css
.card {
  transition: transform 200ms ease-out, box-shadow 200ms ease-out;
}
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(0,0,0,0.08);
}
```

**Staggered list entrance — Framer Motion**
```tsx
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

<motion.ul variants={container} initial="hidden" animate="show">
  {items.map(i => <motion.li key={i.id} variants={item}>{i.label}</motion.li>)}
</motion.ul>
```

**Scroll reveal — Framer Motion, `whileInView`, reduced-motion aware**
```tsx
const prefersReduced = useReducedMotion();

<motion.div
  initial={{ opacity: 0, y: prefersReduced ? 0 : 24 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: "-10% 0px" }}
  transition={{ duration: prefersReduced ? 0 : 0.5, ease: "easeOut" }}
>
```

**Scroll-scrubbed parallax — GSAP ScrollTrigger**
```js
gsap.to(".hero-image", {
  yPercent: 20,
  ease: "none",
  scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
});
```

#### Common Mistakes

- Animating `width`/`height`/`top`/`left` for layout changes instead
  of `transform` or a `layout` animation.
- Adding GSAP for a single button hover state that CSS `transition`
  already handles.
- Fixed, long stagger delays on large lists (50 items × 100ms = 5s
  before the last item appears).
- No `prefers-reduced-motion` handling at all.
- Entrance animations that re-trigger on every parent re-render
  because they aren't gated by mount/in-view state.
- Scroll listeners doing synchronous DOM reads every scroll event
  (layout thrash) instead of using IntersectionObserver/ScrollTrigger.
- Page transitions that block clicks/navigation for longer than the
  animation genuinely needs.

#### Best Practices

- Default to the simplest tool that achieves the effect — CSS before
  a library, Framer Motion before GSAP, declarative variants before
  imperative timelines.
- Keep easing/duration choices consistent across similar interaction
  types sitewide (all card hovers use the same curve/duration) rather
  than tuning each one independently.
- Use `once: true` on scroll-triggered entrance animations unless
  there's a specific reason content should re-animate every time it
  re-enters the viewport.
- Test stagger/list animations with a realistic item count, not just
  3 demo items.

#### Anti-patterns

- ❌ Animating `box-shadow`'s blur radius directly on hover for many
  cards in a grid (expensive repaint) — animate `opacity` of a
  pre-blurred shadow layer instead, or `transform` scale.
- ❌ A different easing curve for every component "because it felt
  right in isolation."
- ❌ Infinite/looping decorative animation with no reduced-motion
  fallback.
- ❌ Using `setTimeout` chains to fake a sequence a library's
  built-in orchestration (`staggerChildren`, GSAP timelines) already
  handles correctly and interruptibly.

#### Checklist

- [ ] Correct tool chosen for the animation type (CSS / Framer Motion
      / Motion One / GSAP), matched to existing dependencies
- [ ] Only `transform`/`opacity` animated, or `layout` animation used
      for layout changes
- [ ] Duration and easing match the interaction's weight, not a
      default guess
- [ ] Stagger delay capped for large lists
- [ ] `prefers-reduced-motion` fallback implemented
- [ ] Animation is interruptible (rapid re-trigger doesn't jank/stick)
- [ ] Scroll-based triggers use IntersectionObserver/ScrollTrigger,
      not raw unthrottled scroll listeners
- [ ] No animation blocks user interaction longer than intended

#### Success Criteria

- Every animation runs smoothly (no visible jank/frame drops) with a
  realistic element count.
- `prefers-reduced-motion: reduce` produces a calm, instant or
  minimal-motion experience with no missing states.
- No animation library is duplicated or added unnecessarily alongside
  one the project already uses.
- Rapid, repeated user interaction (hover in/out, fast scroll)
  produces no visual glitches or stuck states.

### ui-animation: examples

#### Example 1 — Button hover/press (CSS only)

```css
.btn {
  transition: transform 150ms ease-out, background-color 150ms ease-out;
}
.btn:hover { background-color: var(--btn-hover); }
.btn:active { transform: scale(0.97); }
```
No library needed. This is the majority case for simple interactive
feedback — reach for Framer Motion only once gesture physics,
orchestration, or exit animations are actually required.

---

#### Example 2 — Modal enter/exit with exit animation

Plain CSS can't animate an element on *unmount* (it's removed from
the DOM before a transition can run). This is exactly the case
Framer Motion's `AnimatePresence` solves:

```tsx
import { AnimatePresence, motion } from "motion/react";

<AnimatePresence>
  {open && (
    <motion.div
      className="fixed inset-0 bg-black/40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="modal"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

---

#### Example 3 — Staggered grid entrance, capped for large counts

```tsx
const MAX_STAGGER_MS = 400; // never let the last item wait longer than this

function staggerFor(count: number) {
  const perItem = Math.min(0.06, MAX_STAGGER_MS / 1000 / count);
  return { staggerChildren: perItem };
}

<motion.ul
  initial="hidden"
  whileInView="show"
  viewport={{ once: true }}
  variants={{ show: { transition: staggerFor(items.length) } }}
>
  {items.map((item) => (
    <motion.li
      key={item.id}
      variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {item.label}
    </motion.li>
  ))}
</motion.ul>
```

---

#### Example 4 — Reduced-motion-aware hook (reusable)

```tsx
import { useReducedMotion } from "motion/react";

function useEntranceVariants() {
  const reduced = useReducedMotion();
  return {
    hidden: { opacity: 0, y: reduced ? 0 : 16 },
    show: { opacity: 1, y: 0, transition: { duration: reduced ? 0.01 : 0.4, ease: "easeOut" } },
  };
}
```
Use this hook everywhere entrance animation is needed instead of
duplicating the reduced-motion branch per component.

---

#### Example 5 — GSAP ScrollTrigger pin + reveal sequence

Use GSAP when the choreography genuinely needs a timeline (multiple
elements animating in a specific relative sequence tied to scroll
position), not for a single fade-in.

```js
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

const tl = gsap.timeline({
  scrollTrigger: {
    trigger: ".feature-section",
    start: "top 70%",
    end: "top 20%",
    scrub: 0.5,
  },
});

tl.from(".feature-heading", { opacity: 0, y: 30, ease: "none" })
  .from(".feature-image", { opacity: 0, scale: 0.94, ease: "none" }, "<0.1")
  .from(".feature-list li", { opacity: 0, x: -16, stagger: 0.08, ease: "none" }, "<0.2");
```

---

#### Example 6 — What NOT to do: animating layout properties

```css
/* Wrong — triggers layout on every frame, will drop frames with
   more than a few simultaneous instances */
.card { transition: width 300ms, height 300ms, top 300ms; }
.card:hover { width: 320px; height: 400px; top: -8px; }
```

```css
/* Right — transform-only, compositor-friendly */
.card { transition: transform 300ms ease-out; }
.card:hover { transform: translateY(-8px) scale(1.02); }
```
If the element genuinely needs to change size (not just appear to),
use Framer Motion's `layout` prop, which computes the size delta and
animates it via transform (FLIP technique) instead of animating
`width`/`height` directly:

```tsx
<motion.div layout transition={{ duration: 0.3, ease: "easeInOut" }}>
```

---

## micro-interactions

> Add small, premium interaction feedback — button press states, loading/skeleton states, hover cursor effects, input focus feedback, toggle/checkbox transitions, and subtle haptic-feeling UI response — that make an interface feel alive without becoming distracting. Use when: "add a hover effect", "this feels static/ dead", "add a loading state", "make this button feel better", "add polish to the interactions". NOT for: large-scale orchestrated motion (page transitions, scroll choreography — see ui-animation, though the two skills overlap and either may apply to a given task).

### Micro-interactions

Add the small, felt details that make an interface respond to the
user — without adding visual noise or distraction.

#### Objective

Implement small-scale interaction feedback (press states, hover
response, loading/empty/success states, focus feedback, toggle
transitions) that makes the interface feel immediately responsive
and considered, calibrated to be felt more than consciously noticed.

#### Scope

- Button/control press and hover feedback.
- Loading states (skeletons, spinners, progress indication).
- Toggle/checkbox/switch state transitions.
- Cursor-following or proximity-based hover effects.
- Success/error feedback on actions (form submit, copy-to-clipboard,
  like/favorite toggle).
- Overlaps with `ui-animation` for the underlying motion mechanics —
  this skill focuses on *which* interactions deserve feedback and
  what that feedback should communicate, `ui-animation` on *how* to
  implement it performantly.

#### Rules

1. **Every interactive element gives immediate feedback on
   interaction** — a button press, hover, or toggle should never
   feel inert. At minimum: a state change visible within ~100ms of
   the input.
2. **Feedback should be feel-able, not attention-grabbing.** Scale
   changes of 2-5%, subtle color shifts, soft shadows — not large
   bounces, spins, or color inversions for routine interactions.
   Reserve bigger, more noticeable motion for genuinely significant
   moments (a successful purchase, not a checkbox toggle).
3. **Loading states must always appear for any action taking more
   than ~300-400ms** — never leave the UI static and ambiguous while
   work happens in the background. Under that threshold, a loading
   state can itself feel like unnecessary flicker; prefer optimistic
   UI when safe to do so instead.
4. **Skeleton loaders should match the real content's shape** — a
   skeleton that doesn't resemble the eventual layout causes a jarring
   shift when real content arrives, defeating its purpose.
5. **Every destructive or important async action needs completion
   feedback** — success and error states must be visually distinct
   and clear, not just "the spinner went away."
6. **Cursor/hover effects must not obscure content or interfere with
   interaction** — a hover-follow glow or cursor effect is
   decoration, and must never sit above interactive elements in a way
   that could visually confuse hit-testing (even though CSS
   `pointer-events` correctness is what actually prevents this, the
   effect's opacity/positioning should never visually suggest it's
   clickable when it isn't).
7. **Disabled states are visually unambiguous** — a disabled button
   must look clearly non-interactive (reduced opacity/contrast,
   `cursor: not-allowed`), not identical to its enabled state with
   only a functional difference.
8. **Copy-to-clipboard, like/favorite, and similar instant-toggle
   actions get an immediate, satisfying confirmation** (an icon swap,
   a brief color pulse, a small scale bounce) — these are exactly the
   interactions where a well-tuned micro-interaction has the highest
   perceived-quality payoff per unit of effort.
9. **Respect `prefers-reduced-motion`** on every micro-interaction
   that involves movement, same as any other animation (see
   `accessibility` / `ui-animation`).
10. **Don't animate everything.** A page where every single element
    has a hover effect, a load-in animation, and a press state
    becomes noisy rather than premium — reserve micro-interactions
    for elements the user actually interacts with meaningfully, not
    every static text label.

#### Constraints

- Keep durations short (100-250ms for most micro-interactions) —
  see `ui-animation`'s duration guidance for the shared underlying
  rules.
- Don't block the actual action behind its feedback animation — a
  button's press-scale effect must not delay the click handler
  firing.
- Loading states must have a genuine maximum/fallback (a stuck
  infinite spinner with no timeout/error path is worse than no
  loading state at all).

#### Workflow

1. **Identify interactions that currently feel inert** — elements
   with no hover/press/focus feedback, actions with no loading state,
   toggles that snap with no transition.
2. **Classify the interaction's significance** — routine (list item
   hover, button press) gets subtle feedback; significant (purchase
   complete, item deleted) can support more noticeable feedback.
3. **Add immediate state feedback** (hover/press/focus) calibrated to
   Rule 2's subtlety bar.
4. **Add loading states** for any action that can take >300-400ms,
   shaped to match the eventual content (skeleton) or the action's
   nature (spinner for indeterminate, progress bar for measurable
   progress).
5. **Add completion feedback** (success/error) for async actions,
   visually distinct from the loading and idle states.
6. **Verify disabled states are visually unambiguous.**
7. **Verify reduced-motion behavior** for any motion-based feedback.
8. **Step back and check for noise** — if everything on the screen
   now has a hover effect, reduce to what's actually meaningful.

#### Examples

**Button press feedback (CSS-only)**
```css
.btn {
  transition: transform 120ms ease-out, background-color 150ms ease-out;
}
.btn:hover { filter: brightness(1.05); }
.btn:active { transform: scale(0.97); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; filter: none; }
```

**Skeleton loader matching real content shape**
```tsx
function ProductCardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="aspect-square animate-pulse rounded-lg bg-neutral-200" />
      <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-200" />
      <div className="h-4 w-1/3 animate-pulse rounded bg-neutral-200" />
    </div>
  );
}
```

**Copy-to-clipboard with instant confirmation**
```tsx
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={handleCopy} className="relative">
      <motion.span
        key={copied ? "check" : "copy"}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
      >
        {copied ? <CheckIcon className="text-emerald-600" /> : <CopyIcon />}
      </motion.span>
    </button>
  );
}
```

**Like/favorite toggle with a satisfying bounce**
```tsx
<motion.button
  onClick={toggleLike}
  whileTap={{ scale: 0.85 }}
  animate={{ scale: liked ? [1, 1.2, 1] : 1 }}
  transition={{ duration: 0.3 }}
>
  <HeartIcon className={liked ? "fill-red-500 text-red-500" : "text-neutral-400"} />
</motion.button>
```

#### Common Mistakes

- No visible state at all on hover/press for a clickable element.
- Loading states that don't appear until well after work has already
  started being perceptible as lag (should appear promptly once the
  >300ms threshold is crossed, not delayed further).
- A generic gray box skeleton that doesn't resemble the actual
  content's layout, causing a jarring pop when real content arrives.
- Disabled buttons that look identical to enabled ones.
- Adding a bouncy, attention-grabbing animation to routine, frequent
  interactions (e.g. every list item hover), causing visual fatigue.
- An infinite spinner with no timeout or error fallback if the
  action never resolves.
- Applying hover/load-in effects to literally every element on a
  page regardless of whether it's interactive.

#### Best Practices

- Reserve the most noticeable feedback for the least frequent, most
  significant actions; keep frequent/routine interactions subtle.
- Match skeleton loaders to real content dimensions and layout.
- Make disabled states unambiguous through both opacity and cursor.
- Use `whileTap`/`:active` press feedback on every clickable element,
  it's cheap and consistently improves perceived responsiveness.

#### Anti-patterns

- ❌ A static button with no hover/press feedback at all.
- ❌ A full-page blocking spinner for a sub-300ms action.
- ❌ A heart/like animation so large and bouncy it distracts from the
  content around it.
- ❌ Every card on a page independently animating in with a different
  random delay, reading as chaotic rather than considered.
- ❌ A disabled button that's fully interactive-looking, confusing
  the user about why nothing happens on click.

#### Checklist

- [ ] Every interactive element has visible hover/press/focus
      feedback
- [ ] Feedback intensity matches the interaction's significance
      (subtle for routine, more noticeable for significant moments)
- [ ] Loading states present for any action that can exceed ~300-400ms
- [ ] Skeleton loaders shaped to match real content
- [ ] Success/error completion feedback distinct from loading/idle
      states
- [ ] Disabled states visually unambiguous
- [ ] Copy/like/favorite-style instant actions have satisfying,
      immediate confirmation
- [ ] `prefers-reduced-motion` respected
- [ ] Not every element on the page has been given decorative motion
      — reserved for meaningful interactions

#### Success Criteria

- The interface feels immediately responsive to every interaction
  without any single effect drawing disproportionate attention.
- No action leaves the user wondering whether their input registered.
- Loading and error states are handled for every async interaction,
  with no dead-end infinite spinners.
- Reduced-motion users get an equally clear, just calmer, experience.

### micro-interactions: examples

#### Example 1 — Complete button state set

```css
.btn {
  transition: transform 120ms ease-out, filter 150ms ease-out, opacity 150ms ease-out;
}
.btn:hover:not(:disabled)  { filter: brightness(1.05); }
.btn:active:not(:disabled) { transform: scale(0.97); }
.btn:focus-visible         { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.btn:disabled              { opacity: 0.5; cursor: not-allowed; }
```
Every state (rest, hover, active, focus, disabled) is covered, none
of them overlap or contradict each other, and disabled is visually
unambiguous.

---

#### Example 2 — Loading state with a sensible threshold

```tsx
function SubmitButton() {
  const [pending, setPending] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);

  const handleSubmit = async () => {
    setPending(true);
    const timer = setTimeout(() => setShowSpinner(true), 300); // don't flash a spinner for instant responses
    await submitForm();
    clearTimeout(timer);
    setPending(false);
    setShowSpinner(false);
  };

  return (
    <button onClick={handleSubmit} disabled={pending}>
      {showSpinner ? <Spinner className="size-4" /> : "Submit"}
    </button>
  );
}
```
If the request resolves in under 300ms, the user never sees a
flicker; if it takes longer, the spinner appears promptly and stays
until done.

---

#### Example 3 — Skeleton shaped to match real content

```tsx
function ReviewCard({ review }: { review?: Review }) {
  if (!review) {
    return (
      <div className="flex gap-3 p-4">
        <div className="size-10 shrink-0 animate-pulse rounded-full bg-neutral-200" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/4 animate-pulse rounded bg-neutral-200" />
          <div className="h-3 w-full animate-pulse rounded bg-neutral-200" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-neutral-200" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3 p-4">
      <img src={review.avatar} className="size-10 shrink-0 rounded-full" alt="" />
      <div>
        <p className="text-sm font-medium">{review.name}</p>
        <p className="text-sm text-neutral-600">{review.text}</p>
      </div>
    </div>
  );
}
```
The skeleton mirrors the avatar + two-line-text layout exactly, so
real content arriving doesn't cause a layout jump.

---

#### Example 4 — Success/error feedback distinct from loading

```tsx
type Status = "idle" | "pending" | "success" | "error";

function SaveButton({ onSave }: { onSave: () => Promise<void> }) {
  const [status, setStatus] = useState<Status>("idle");

  const handleClick = async () => {
    setStatus("pending");
    try {
      await onSave();
      setStatus("success");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("error");
    }
  };

  return (
    <button onClick={handleClick} disabled={status === "pending"} className={cn(
      "btn",
      status === "success" && "bg-emerald-600",
      status === "error" && "bg-red-600"
    )}>
      {status === "pending" && <Spinner className="size-4" />}
      {status === "success" && <CheckIcon className="size-4" />}
      {status === "error" && "Try again"}
      {status === "idle" && "Save"}
    </button>
  );
}
```

---

#### Example 5 — Toggle switch with a smooth, subtle transition

```tsx
<button
  role="switch"
  aria-checked={enabled}
  onClick={() => setEnabled(!enabled)}
  className={cn(
    "relative h-6 w-11 rounded-full transition-colors duration-200",
    enabled ? "bg-brand" : "bg-neutral-300"
  )}
>
  <motion.span
    className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm"
    animate={{ x: enabled ? 20 : 0 }}
    transition={{ type: "spring", stiffness: 500, damping: 30 }}
  />
</button>
```
A spring transition on the thumb feels tactile without being bouncy
or slow — appropriate for a frequent, routine interaction.

---

## accessibility

> Build interfaces with semantic HTML, correct ARIA usage, full keyboard navigability, visible focus states, prefers-reduced-motion support, and WCAG 2.1 AA compliance by default — not as a retrofitted pass. Use when: "make this accessible", "add ARIA labels", "keyboard navigation isn't working", "check accessibility", "WCAG compliance", and by default on every new interactive component regardless of whether accessibility is explicitly mentioned. NOT for: visual design taste (see premium-ui) or motion mechanics beyond reduced-motion support (see ui-animation).

### Accessibility

Build every interactive piece of UI to be usable by keyboard, screen
reader, and assistive technology from the start — not bolted on
after a complaint.

#### Objective

Ensure semantic HTML is used as the default building block, ARIA is
used correctly and only when semantic HTML can't express the pattern,
every interactive element is fully keyboard operable with a visible
focus indicator, motion respects `prefers-reduced-motion`, and color
contrast and other WCAG 2.1 AA success criteria are met — applied
proactively on every component, not only when explicitly requested.

#### Scope

- Every interactive/informational UI element built or modified.
- Semantic structure, ARIA, keyboard interaction, focus management,
  color contrast, motion safety, and screen-reader announcement
  correctness.
- Applies by default, silently, alongside whatever else is being
  built — this is baseline quality, not a separate opt-in feature.

#### Rules

1. **Use the native semantic element first.** A `<button>` for
   anything clickable-and-actionable, `<a>` for navigation, real
   `<h1>`-`<h6>` in a logical hierarchy, `<label>` (or
   `aria-label`/`aria-labelledby`) for every form control, `<nav>`,
   `<main>`, `<header>`, `<footer>` for landmarks. Reach for a `<div>`
   + ARIA role only when no native element expresses the pattern.
2. **ARIA supplements semantics, it doesn't replace them.** Don't add
   `role="button"` to a `<div>` when a real `<button>` would work —
   the native element gets keyboard handling, focusability, and
   correct default semantics for free; a div with a role needs all of
   that added manually and is easy to get subtly wrong.
3. **Every interactive element must be keyboard operable**: reachable
   via `Tab` in a logical order, activatable via `Enter`/`Space` as
   appropriate for its role, and any custom widget (menu, tabs,
   combobox, modal) must implement the expected keyboard pattern for
   that widget type (see WAI-ARIA Authoring Practices patterns) —
   arrow keys for menus/tabs, `Escape` to close overlays, focus
   trapped appropriately inside modals and returned to the trigger on
   close.
4. **Focus must always be visible.** Never remove a focus outline
   (`outline: none`) without providing an equally or more visible
   custom focus style — invisible focus is a hard accessibility
   failure, not a visual nitpick.
5. **Every image needs correct `alt`** — descriptive for meaningful
   images, empty (`alt=""`) for decorative ones, never omitted.
6. **Color is never the only signal.** Any state or information
   conveyed by color (error, success, required field, active tab)
   must also be conveyed by text, icon, or another non-color cue —
   for users with color vision deficiency.
7. **Color contrast meets WCAG AA**: 4.5:1 for normal text, 3:1 for
   large text (18pt+/14pt+bold) and for UI component boundaries/
   graphical objects that convey information.
8. **Respect `prefers-reduced-motion`** on every non-trivial
   animation (see `ui-animation` for implementation depth) — this is
   an accessibility requirement, not optional polish.
9. **Dynamic content changes are announced appropriately.** Content
   that updates without a page navigation (form validation errors,
   toast notifications, live search results) needs an
   `aria-live` region (or a native mechanism like `<dialog>`) so
   screen reader users are informed — silent DOM updates are
   invisible to them.
10. **Modals/dialogs trap focus while open and restore it on
    close.** Focus must not leak to content behind the overlay, and
    `Escape` must close it.
11. **Never rely on placeholder text as a label substitute.** A
    placeholder disappears on input and is insufficient contrast/
    context for many users — always pair it with a real `<label>`.
12. **Touch targets are large enough** (~44×44px minimum) for users
    with motor impairments, not just for aesthetic density.

#### Constraints

- Don't add ARIA attributes speculatively "to be safe" — incorrect
  or redundant ARIA (e.g. `role="button"` on an actual `<button>`,
  or `aria-label` duplicating already-visible text unhelpfully) can
  make the experience worse, not better. Verify each ARIA addition
  against its actual purpose.
- Don't build a custom-styled version of a native control (checkbox,
  radio, select) without preserving full native keyboard/screen-reader
  behavior — if the native element can be styled sufficiently, prefer
  that over a custom reimplementation.
- Accessibility fixes should not visually regress the design without
  discussion — a visible focus ring, adequate contrast, and adequate
  touch target size can usually be achieved within the existing
  visual language; flag it explicitly on the rare occasion a real
  trade-off exists.

#### Workflow

1. **Default to semantic HTML** for every element as it's written —
   this is the first decision, not a later audit pass.
2. **For any custom interactive widget** (dropdown, tabs, modal,
   combobox, carousel), check the WAI-ARIA Authoring Practices
   pattern for that widget type and implement its expected roles,
   states, and keyboard interactions completely, not partially.
3. **Verify keyboard operability** by reasoning through (or testing,
   if tooling allows) a `Tab`-only traversal: can every interactive
   element be reached and activated without a mouse, in a sensible
   order?
4. **Verify focus visibility** — confirm no `outline: none` exists
   without a replacement focus style.
5. **Check color contrast** for text and meaningful UI boundaries
   against the actual background it renders on, especially for
   secondary/muted text colors which are the most common contrast
   failures.
6. **Add `aria-live` regions** for any content that updates without
   navigation and needs to be noticed by assistive tech users.
7. **Handle modal/overlay focus management** — trap focus while open,
   restore focus to the trigger on close, close on `Escape`.
8. **Apply `prefers-reduced-motion`** handling to any animation added.
9. **Review ARIA usage for necessity and correctness** — remove any
   that duplicates native semantics or was added speculatively
   without a clear purpose.

#### Examples

**Semantic button, not a styled div**
```tsx
// Avoid
<div className="btn" onClick={handleClick} tabIndex={0} onKeyDown={handleKeyDown}>Save</div>

// Prefer — free keyboard handling, focusability, and semantics
<button className="btn" onClick={handleClick}>Save</button>
```

**Accessible custom dropdown (roles + keyboard pattern)**
```tsx
<button aria-haspopup="listbox" aria-expanded={open} onClick={toggle}>
  {selected.label}
</button>
{open && (
  <ul role="listbox" aria-activedescendant={activeId} onKeyDown={handleListKeyDown}>
    {options.map(o => (
      <li key={o.id} id={o.id} role="option" aria-selected={o.id === selected.id}>
        {o.label}
      </li>
    ))}
  </ul>
)}
```

**Visible custom focus style instead of removing outline**
```css
button:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

**Live region for async validation feedback**
```tsx
<p role="status" aria-live="polite" className="text-sm text-red-600">
  {error}
</p>
```

**Form field with a real label, not just a placeholder**
```tsx
<label htmlFor="email" className="text-sm font-medium">Email</label>
<input id="email" type="email" placeholder="you@example.com" />
```

#### Common Mistakes

- A `<div onClick>` used instead of a `<button>`, losing keyboard
  operability and requiring manual `tabIndex`/`onKeyDown`
  reimplementation (often incompletely).
- `outline: none` with no replacement focus style.
- A form input with only a placeholder, no `<label>`.
- A red border as the only signal of a form error, with no text/icon.
- A modal that doesn't trap focus, letting `Tab` reach content behind
  the overlay.
- A toast/alert that appears and disappears with no `aria-live`
  region, invisible to screen reader users.
- Redundant ARIA on native elements (`role="button"` on a
  `<button>`, `aria-label` that just repeats visible button text
  unhelpfully).
- Secondary/muted gray text that fails contrast against its
  background.

#### Best Practices

- Reach for the WAI-ARIA Authoring Practices Guide pattern for any
  custom widget rather than improvising roles/keyboard behavior.
- Test (or reason through) every new interactive component with
  keyboard-only navigation before considering it done.
- Prefer styling native controls over rebuilding them, when visually
  feasible.
- Keep focus styles visible and reasonably consistent across the
  app's interactive elements.

#### Anti-patterns

- ❌ Clickable `<div>`/`<span>` elements without keyboard support.
- ❌ `outline: none` left with no replacement.
- ❌ Color-only error/success/state indication.
- ❌ A custom modal with no focus trap.
- ❌ ARIA attributes sprinkled speculatively without checking they're
  correct or necessary.
- ❌ Placeholder-only form fields with no associated label.

#### Checklist

- [ ] Semantic HTML used as the default for every element
- [ ] Custom widgets follow the correct WAI-ARIA pattern (roles,
      states, keyboard interaction) for their type
- [ ] Full keyboard operability verified (Tab order, activation keys,
      Escape/arrow patterns where applicable)
- [ ] Visible focus indicator on every interactive element
- [ ] All images have correct `alt` (descriptive or empty)
- [ ] No information conveyed by color alone
- [ ] Text and meaningful UI contrast meets WCAG AA (4.5:1 / 3:1)
- [ ] `prefers-reduced-motion` respected on animations
- [ ] Dynamic content changes use `aria-live` where appropriate
- [ ] Modals trap focus and restore it on close
- [ ] Every form field has a real associated label, not just a
      placeholder
- [ ] Touch targets ≥~44×44px

#### Success Criteria

- The entire interface is operable via keyboard alone, with visible
  focus at every step.
- A screen reader announces meaningful, non-redundant information for
  every element, including dynamic updates.
- Automated accessibility checks (axe, Lighthouse accessibility
  audit) pass with no serious/critical issues.
- No accessibility fix required a separate "accessibility pass" —
  it was built in from the start.

### accessibility: examples

#### Example 1 — Clickable div → real button

**Before:**
```tsx
<div className="card" onClick={() => router.push(`/product/${id}`)}>
  <img src={image} alt={name} />
  <h3>{name}</h3>
</div>
```
Not focusable, not activatable via keyboard, not announced as
interactive to screen readers.

**After:**
```tsx
<Link href={`/product/${id}`} className="card block">
  <img src={image} alt="" /> {/* decorative here since the name below already conveys it */}
  <h3>{name}</h3>
</Link>
```
A real `<a>` (via `Link`) gets full keyboard/screen-reader support
for free, since this is navigation, not an arbitrary click handler.

---

#### Example 2 — Accessible modal with focus trap and restore

```tsx
function Modal({ open, onClose, children }: ModalProps) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement;
      dialogRef.current?.focus();
    } else {
      triggerRef.current?.focus(); // restore focus on close
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="modal"
      >
        <h2 id="modal-title">Confirm</h2>
        {children}
      </div>
    </div>
  );
}
```
For production use, prefer the native `<dialog>` element or a library
(Radix UI, Headless UI) that implements the full focus-trap
specification — the above is illustrative of the required behaviors,
not a complete implementation (full focus trap needs to prevent `Tab`
from leaving the dialog entirely, not just restore focus on close).

---

#### Example 3 — Live region for async form feedback

```tsx
function EmailField() {
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <label htmlFor="email" className="text-sm font-medium">Email</label>
      <input
        id="email"
        type="email"
        aria-invalid={!!error}
        aria-describedby={error ? "email-error" : undefined}
        onBlur={(e) => setError(validate(e.target.value))}
      />
      <p id="email-error" role="alert" className="text-sm text-red-600">
        {error}
      </p>
    </div>
  );
}
```
`role="alert"` (an implicit `aria-live="assertive"` region) ensures
the error is announced the moment it appears, and `aria-describedby`
links the input to it for screen reader context when focused.

---

#### Example 4 — Visible focus style instead of removing it

**Wrong:**
```css
button:focus { outline: none; } /* invisible to keyboard users */
```

**Right:**
```css
button:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
/* :focus-visible avoids showing the ring on mouse clicks while
   still showing it for keyboard navigation */
```

---

#### Example 5 — Error state conveyed by more than color

**Wrong:**
```tsx
<input className={hasError ? "border-red-500" : "border-gray-300"} />
```
A user with red-green color vision deficiency may not perceive the
difference.

**Right:**
```tsx
<input
  className={hasError ? "border-red-500" : "border-gray-300"}
  aria-invalid={hasError}
/>
{hasError && (
  <p className="flex items-center gap-1 text-sm text-red-600">
    <AlertIcon aria-hidden="true" className="size-4" />
    This field is required
  </p>
)}
```
Color, icon, and text together — not color alone.

---

#### Example 6 — Reduced motion respected in a real component

```tsx
function FadeInSection({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: reduced ? 0 : 0.4 }}
    >
      {children}
    </motion.div>
  );
}
```

---

## image-optimization

> Optimize all images using next/image (or the framework's equivalent), modern formats (AVIF/WebP with fallback), correct responsive `sizes`, lazy loading by default with priority/preload for hero/LCP images, and blur placeholders — instead of raw <img> tags serving oversized, unoptimized originals. Use when: "optimize these images", "images are slow to load", "improve LCP", "add image loading states", any task that adds or touches an <img>/Image element. NOT for: general Core Web Vitals work beyond images (see performance).

### Image Optimization

Serve every image at the right size, format, and loading priority —
never a raw, oversized original loaded eagerly regardless of whether
it's above or below the fold.

#### Objective

Ensure every image in the project is served through the framework's
image optimization pipeline (`next/image` in Next.js, or the
equivalent), in a modern format with fallback, sized appropriately
for its rendered dimensions across breakpoints, lazy-loaded unless it
is a Largest Contentful Paint (LCP) candidate, and accompanied by a
placeholder that prevents layout shift and jarring pop-in.

#### Scope

- Every `<img>`/`Image` usage added or touched in the project.
- Covers format selection, responsive `sizes`, loading strategy
  (lazy vs. priority/preload), placeholder strategy, and layout-shift
  prevention.
- Does not cover broader Core Web Vitals work unrelated to images
  (bundle splitting, font loading, etc. — see `performance`).

#### Rules

1. **Always use the framework's optimized image component** —
   `next/image` in Next.js — instead of a raw `<img>` tag, unless
   there is a specific, stated reason it can't be used (e.g. an
   external domain that can't be configured, or a non-Next context).
2. **Always set explicit dimensions or `fill` with a sized, `position:
   relative` parent.** An image with no known dimensions causes
   layout shift (a Core Web Vitals CLS penalty) as it loads — never
   ship an image whose container has no reserved space.
3. **Set `sizes` correctly whenever the image is not always rendered
   at the same fixed pixel width.** A `fill` or responsive image
   without a `sizes` attribute matching its actual rendered width at
   each breakpoint causes the browser to over-download a larger
   variant than needed.
4. **Lazy-load by default.** Every image below the fold should lazy
   load (the framework's default) — don't add `priority`/`eager`
   loading indiscriminately across every image on a page.
5. **Mark exactly the LCP candidate (usually one hero image) as
   priority/preloaded**, not more. Over-marking multiple images as
   `priority` defeats the purpose (they compete for the same early
   bandwidth) and can itself hurt LCP.
6. **Use a blur or dominant-color placeholder** for images that take
   meaningful time to load (most photographic content) — a plain
   empty box popping to a photo is a worse experience than a
   low-fidelity preview that resolves into it.
7. **Prefer AVIF/WebP with automatic fallback** over shipping raw
   JPEG/PNG — the framework's image pipeline typically handles this
   automatically; verify it's actually configured/enabled rather than
   assuming.
8. **Never upload/reference a source image larger than the largest
   size it will ever be rendered at.** A 4000px-wide source for an
   image that never renders wider than 800px wastes processing and
   bandwidth even through an optimizer — downscale the source itself
   when it's dramatically oversized.
9. **Decorative images get empty `alt=""`; meaningful images get a
   real, descriptive `alt`.** Never omit `alt` entirely (accessibility
   failure) and never stuff it with keywords (also see
   `accessibility`).
10. **External/remote images must be added to the framework's allowed
    domains config** before use — don't bypass optimization by
    pointing at an unoptimized raw external URL when the source could
    be configured or downloaded and self-hosted instead.

#### Constraints

- Don't leave temporary/expiring asset URLs (e.g. from a design tool
  export) in committed code — download and self-host before shipping,
  per `figma-pixel-perfect`'s asset rule.
- Don't disable the framework's image optimization (`unoptimized`)
  without a specific, stated reason (e.g. a static export target that
  can't run the optimization server) — it's a meaningful regression,
  not a neutral config toggle.
- Respect the project's existing image domain allowlist configuration
  rather than loosening it broadly (e.g. wildcarding all domains) to
  avoid a one-time config addition.

#### Workflow

1. **Identify the image's role**: is it the likely LCP element (hero,
   above-the-fold primary content image), a below-the-fold content
   image, or decorative?
2. **Choose loading strategy** accordingly: `priority` for the one
   LCP candidate, default lazy loading for everything else.
3. **Set dimensions or `fill`** with a properly sized/positioned
   parent — never let an image's box collapse to zero before load.
4. **Set `sizes`** to match actual rendered width across breakpoints
   if the image isn't always the same fixed pixel size.
5. **Add a placeholder** (`placeholder="blur"` with a `blurDataURL`,
   or a dominant-color CSS background) for photographic content that
   takes noticeable time to load.
6. **Verify format/quality settings** are using the framework's
   defaults or explicitly reasonable overrides — don't force
   maximum quality on every image indiscriminately (larger file size
   for imperceptible gain).
7. **Verify `alt` text** is present and appropriate (empty for
   decorative, descriptive for meaningful).
8. **Check source image dimensions** aren't wildly oversized relative
   to maximum render size.
9. **Confirm no layout shift** — the image's container should hold
   its size before/during/after load.

#### Examples

**Hero/LCP image**
```tsx
<Image
  src="/images/hero.jpg"
  alt="Fresh cheese pizza with basil"
  fill
  priority
  sizes="100vw"
  className="object-cover"
/>
```

**Responsive content image with correct `sizes`**
```tsx
<Image
  src={dish.image}
  alt={dish.name}
  fill
  sizes="(max-width: 768px) 50vw, 25vw"
  className="object-cover"
/>
```
`sizes` here reflects that the image renders at ~50% viewport width
on mobile (2-column grid) and ~25% on desktop (4-column grid) — not
a blanket `100vw` that would cause over-fetching on desktop.

**Below-the-fold image with blur placeholder**
```tsx
<Image
  src={photo.src}
  alt={photo.alt}
  width={400}
  height={300}
  placeholder="blur"
  blurDataURL={photo.blurDataURL}
/>
```

**Decorative image**
```tsx
<Image src="/images/texture-bg.png" alt="" fill className="object-cover opacity-10" />
```

#### Common Mistakes

- Using a raw `<img>` tag in a Next.js project instead of
  `next/image`, losing all automatic optimization.
- Marking every image on a page `priority`, which competes for
  bandwidth and can worsen actual LCP.
- Missing `sizes` on a `fill` image that renders at a small fraction
  of viewport width, causing the browser to download a full-viewport-
  sized asset.
- No reserved space for an image (missing width/height or `fill` +
  sized parent), causing layout shift as it loads in.
- Uploading a 4000px-wide source photo for a 200px avatar.
- Empty or missing `alt` on a meaningful, informative image.
- Setting `unoptimized` to sidestep a domain-config step instead of
  actually configuring the allowed remote domain.

#### Best Practices

- Treat "what is this page's LCP element" as a specific question to
  answer per page, not an assumption — it's usually the largest
  above-the-fold image, but confirm rather than mark the first image
  in the DOM priority by default.
- Prefer self-hosting frequently used images over remote domains when
  practical — one less network hop, full control over optimization.
- Keep `sizes` accurate to actual layout — revisit it when a
  responsive grid's column count changes.
- Use blur placeholders generated at build time (many frameworks
  support automatic `blurDataURL` generation) rather than hand-authoring
  them.

#### Anti-patterns

- ❌ Every image on the page marked `priority`.
- ❌ A raw `<img src="...">` used purely to "avoid dealing with
  next/image config."
- ❌ A `fill` image with no `sizes` attribute, silently downloading
  the largest breakpoint variant everywhere.
- ❌ A gallery of 50 lazy images all without placeholders, causing a
  visually noisy pop-in cascade as the user scrolls.
- ❌ `alt="image"` or `alt="photo123.jpg"` as a placeholder that
  provides no real information.

#### Checklist

- [ ] Framework's optimized image component used, not raw `<img>`
- [ ] Explicit dimensions or `fill` + sized parent on every image (no
      layout shift)
- [ ] `sizes` set accurately for any non-fixed-width image
- [ ] Exactly the LCP candidate marked `priority`; everything else
      lazy by default
- [ ] Blur/placeholder strategy applied to meaningful photographic
      content
- [ ] Modern format (AVIF/WebP) pipeline confirmed active, not
      bypassed
- [ ] Source image dimensions reasonable relative to max render size
- [ ] `alt` text correct (descriptive for meaningful images, empty
      for decorative)
- [ ] Remote image domains properly allowlisted, not force-unoptimized

#### Success Criteria

- No layout shift attributable to images on any page.
- LCP is not delayed by competing `priority` images or oversized
  unoptimized sources.
- Lighthouse/PageSpeed image-related audits (properly sized images,
  next-gen formats, offscreen images) pass clean.
- Every image has correct, meaningful `alt` text.

### image-optimization: examples

#### Example 1 — Raw `<img>` vs. `next/image`

**Before:**
```html
<img src="/images/dish.jpg" alt="Truffle mushroom pizza" />
```
No optimization, no responsive variants, no lazy loading control, no
layout-shift prevention.

**After:**
```tsx
<Image
  src="/images/dish.jpg"
  alt="Truffle mushroom pizza"
  width={400}
  height={300}
  className="rounded-lg object-cover"
/>
```

---

#### Example 2 — Hero image (LCP candidate)

```tsx
<section className="relative h-[70vh]">
  <Image
    src="/images/hero-pizza.jpg"
    alt="Hot and fresh cheese pizza"
    fill
    priority
    sizes="100vw"
    className="object-cover"
  />
</section>
```
`priority` preloads this specific image and skips lazy-loading —
correct because it's the page's LCP element. No other image on this
page should also carry `priority`.

---

#### Example 3 — Grid image with accurate `sizes`

A 4-column desktop / 2-column mobile grid:

```tsx
<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
  {dishes.map((dish) => (
    <div key={dish.id} className="relative aspect-square">
      <Image
        src={dish.image}
        alt={dish.name}
        fill
        sizes="(max-width: 768px) 50vw, 25vw"
        className="object-cover"
      />
    </div>
  ))}
</div>
```
`sizes` matches the actual rendered fraction of viewport width at
each breakpoint — the browser requests an appropriately sized variant
instead of a full-viewport-sized one on every card.

---

#### Example 4 — Blur placeholder for a photo gallery

```tsx
// If using static imports, Next.js can generate blurDataURL automatically:
import dishPhoto from "@/public/images/dish.jpg";

<Image src={dishPhoto} alt="Creamy alfredo pasta" placeholder="blur" className="rounded-xl" />
```
For remote/dynamic images without automatic blur generation, use a
small pre-generated base64 placeholder or a dominant-color CSS
background as a fallback:
```tsx
<div className="relative bg-[#c9b79c]"> {/* dominant color of the photo, shown until it loads */}
  <Image src={remoteUrl} alt="..." fill className="object-cover" />
</div>
```

---

#### Example 5 — Decorative image, correctly marked

```tsx
<Image
  src="/images/texture-overlay.png"
  alt=""
  fill
  aria-hidden="true"
  className="object-cover opacity-10 pointer-events-none"
/>
```
Empty `alt` and `aria-hidden` tell assistive technology to skip it —
it carries no information, so it shouldn't be announced.

---

#### Example 6 — Downloading a design-tool asset instead of linking it live

**Wrong (will 404 in ~7 days):**
```tsx
<Image src="https://www.figma.com/api/mcp/asset/e50c7fb1-..." alt="Chef plating a dish" fill />
```

**Right:**
```bash
curl -sL "https://www.figma.com/api/mcp/asset/e50c7fb1-..." -o public/images/kitchen-action-1.jpg
```
```tsx
<Image src="/images/kitchen-action-1.jpg" alt="Chef plating a dish" fill />
```

---

## performance

> Optimize Core Web Vitals (LCP, INP, CLS) and general runtime performance via code splitting, dynamic imports, memoization, bundle size discipline, and avoiding unnecessary re-renders. Use when: "this feels slow", "improve performance", "reduce bundle size", "this re-renders too much", "optimize Core Web Vitals", before shipping a feature that adds a significant dependency. NOT for: image-specific optimization (see image-optimization, though images are also a major LCP factor covered briefly here), animation frame-rate specifically (see ui-animation).

### Performance

Keep the app fast to load and fast to interact with — measured
against Core Web Vitals, not vibes.

#### Objective

Optimize Largest Contentful Paint (LCP), Interaction to Next Paint
(INP), and Cumulative Layout Shift (CLS), along with general bundle
size and runtime responsiveness, using targeted techniques
(code-splitting, dynamic imports, memoization, avoiding unnecessary
work) applied where profiling/reasoning shows they matter — not
defensive optimization applied everywhere regardless of actual cost.

#### Scope

- Bundle size and code-splitting strategy.
- Render performance (unnecessary re-renders, expensive computation
  on the main thread).
- Core Web Vitals specifically: LCP, INP, CLS.
- Data-fetching strategy's performance impact (waterfalls,
  over-fetching).
- Overlaps with `image-optimization` (images are often the LCP
  element) and `ui-animation` (animation frame budget) — defer to
  those skills for their specific depth, this skill covers the
  broader picture.

#### Rules

1. **Measure before optimizing where possible.** A specific,
   reasoned diagnosis ("this component re-renders on every keystroke
   because it's not memoized and its parent re-renders every
   keystroke") beats blanket optimization ("wrap everything in
   `useMemo` just in case").
2. **Code-split by route and by genuinely heavy, conditionally-used
   dependencies.** A large library only needed behind a rarely-used
   feature (a rich text editor, a chart library, a PDF viewer)
   should be dynamically imported, not bundled into the initial
   page load.
3. **Server-render what can be server-rendered.** In Next.js, data
   fetched and rendered on the server doesn't cost client JS or a
   client-side fetch waterfall — prefer it over client-side fetching
   by default (see `react-architecture`).
4. **Memoization is a targeted fix for a measured/reasoned problem,
   not a default wrapper.** `useMemo`/`useCallback`/`React.memo` on
   every component and value adds its own overhead (comparison cost)
   and complexity; apply them where a component is provably
   expensive to re-render, or where referential stability is
   required for a dependency array/prop comparison to work correctly
   — not reflexively everywhere.
5. **Avoid unnecessary re-renders at the source** (state placed too
   high, causing a large subtree to re-render on an unrelated
   change) before reaching for memoization to paper over it —
   fixing the state location is usually the better fix.
6. **Debounce/throttle high-frequency handlers** (search-as-you-type,
   scroll, resize, drag) that trigger expensive work — never run
   expensive computation or a network request on every single event
   firing.
7. **Avoid layout thrash**: batch DOM reads and writes, don't
   interleave `getBoundingClientRect()` reads with style writes in a
   loop.
8. **Keep the main thread free for interaction.** Long synchronous
   tasks (heavy computation, large JSON parsing/sorting on the main
   thread) should be chunked, deferred (`requestIdleCallback`-style
   scheduling, or a web worker for genuinely heavy work), or moved
   server-side — INP suffers when the main thread is busy when the
   user tries to interact.
9. **Bundle analysis before adding a heavy dependency.** Check the
   real cost of a new dependency (bundle size, whether it's tree-
   shakeable) before adding it, especially for something a lighter
   alternative or a few lines of custom code could replace.
10. **CLS is prevented at the layout level**, not patched after the
    fact — reserve space for async content (images, ads, injected
    embeds, web fonts) before it loads, rather than letting it shift
    content on arrival (see `image-optimization` for the
    image-specific case; the same principle applies to fonts —
    use `font-display: swap` with matched fallback metrics, or
    `next/font`'s automatic handling).

#### Constraints

- Don't add a performance-monitoring dependency or custom
  instrumentation as a default part of every task — only when
  specifically requested or genuinely necessary to diagnose an issue.
- Don't remove or bypass framework-level optimizations (e.g.
  disabling React Strict Mode, disabling Next.js's automatic static
  optimization) as a shortcut to "fix" a symptom without
  understanding the actual cause.
- Match optimization effort to actual impact — spending significant
  complexity budget optimizing a rarely-visited admin page's render
  performance is a worse trade than the same effort on the
  high-traffic landing page.

#### Workflow

1. **Identify the actual bottleneck category**: initial load
   (bundle size, LCP), interaction responsiveness (INP, re-render
   cost), or visual stability (CLS) — the fix differs meaningfully
   per category.
2. **For load-time issues**: audit bundle composition (large
   dependencies, unused imports, everything bundled into the initial
   chunk that could be route-split or dynamically imported), and
   check the LCP element specifically (usually an image or a large
   text block — see `image-optimization` if it's an image).
3. **For interaction issues**: identify what re-renders/executes on
   the interaction, whether it's more work than necessary (state
   placed too high, missing debounce, expensive synchronous
   computation), and fix at the source before reaching for
   memoization.
4. **For layout stability issues**: find what's shifting (late-loading
   images/fonts/embeds/ads with no reserved space) and reserve space
   for it up front.
5. **Apply the targeted fix** — dynamic import, state relocation,
   debounce, memoization, server-side data fetching — matched to the
   diagnosed cause.
6. **Verify the fix addresses the specific metric** it targeted,
   where measurement is available (Lighthouse, Web Vitals reporting,
   React DevTools Profiler) — don't assume a fix worked without a way
   to check, and say so if verification tooling isn't available in
   the current environment.

#### Examples

**Dynamic import for a heavy, conditionally-used dependency**
```tsx
const RichTextEditor = dynamic(() => import("./RichTextEditor"), {
  loading: () => <EditorSkeleton />,
  ssr: false, // if it's client-only (e.g. depends on browser APIs)
});
```

**Debouncing a search input instead of firing on every keystroke**
```tsx
const debouncedQuery = useDebouncedValue(query, 300);
useEffect(() => { if (debouncedQuery) searchProducts(debouncedQuery); }, [debouncedQuery]);
```

**Fixing re-renders at the source instead of memoizing around them**
```tsx
// Before: `theme` state lives in the root layout, so every theme
// toggle re-renders the entire tree, including unrelated content.
function RootLayout() {
  const [theme, setTheme] = useState("light");
  return <App theme={theme} onToggle={setTheme} />; // whole app re-renders on toggle
}

// After: theme state + the components that actually depend on it
// are isolated, so toggling doesn't re-render unrelated content.
function RootLayout() {
  return (
    <ThemeProvider> {/* only its own subtree re-renders on change */}
      <App />
    </ThemeProvider>
  );
}
```

**Reserving space to prevent CLS from a late-loading embed**
```tsx
<div className="aspect-video w-full bg-neutral-100"> {/* reserved space before the embed loads */}
  <LazyYouTubeEmbed videoId={id} />
</div>
```

#### Common Mistakes

- Wrapping every component in `React.memo` and every value in
  `useMemo`/`useCallback` without evidence it's needed, adding
  complexity and comparison overhead for no measured benefit.
- Bundling a large library (a chart, a rich text editor, a map)
  into the main chunk when it's only used on one rarely-visited
  route/interaction.
- Firing a network request or expensive filter/sort on every
  keystroke with no debounce.
- Fetching client-side with `useEffect` when the data could have
  been fetched server-side with no client-only dependency.
- Letting web fonts or late-loading embeds shift layout because no
  space was reserved for them.
- Adding a heavy new dependency without checking its actual bundle
  cost or whether a lighter approach would do.

#### Best Practices

- Fix the *cause* of unnecessary work (state placement, missing
  debounce, unnecessary client-side fetch) before reaching for
  memoization to mask its cost.
- Default to server rendering/fetching in frameworks that support it,
  reserving client-side fetching for genuinely interaction-dependent
  data.
- Check bundle impact before adding a dependency, especially for
  something used in a small part of the UI.
- Reserve layout space for anything that loads asynchronously and
  has a footprint (images, fonts, embeds).

#### Anti-patterns

- ❌ `useMemo`/`useCallback` applied reflexively to every value/function
  in a component regardless of actual re-render cost.
- ❌ A 200KB charting library imported at the top of a page that
  rarely renders a chart, instead of dynamically imported behind the
  interaction that needs it.
- ❌ A search box firing an API call on every keystroke with no
  debounce.
- ❌ Disabling Strict Mode or other framework safety nets to make a
  symptom go away without understanding the underlying issue.

#### Checklist

- [ ] Bottleneck category identified (load / interaction / layout
      stability) before choosing a fix
- [ ] Heavy, conditionally-used dependencies dynamically imported,
      not bundled into the initial load
- [ ] Data fetched server-side by default where the framework
      supports it
- [ ] High-frequency handlers (search, scroll, resize) debounced/
      throttled
- [ ] Memoization applied only where a real re-render cost or
      referential-stability need is identified, not reflexively
- [ ] Re-render source (state placement) fixed before/instead of
      papering over it with memoization
- [ ] Space reserved for anything that loads asynchronously and has
      visual footprint (images, fonts, embeds)
- [ ] New heavy dependencies checked for bundle cost before adding

#### Success Criteria

- LCP, INP, and CLS are each addressed by a fix targeted at their
  actual cause, not a blanket "add memoization everywhere" pass.
- Bundle size doesn't grow from dependencies that could have been
  dynamically imported or avoided.
- No component re-renders more than its actual data dependency
  requires.
- No visible layout shift from async content.

### performance: examples

#### Example 1 — Dynamic import behind an interaction

**Before (bundled into every page load):**
```tsx
import { PDFViewer } from "heavy-pdf-lib"; // 300KB+, only used when a user clicks "Preview"

function Document() {
  const [showPreview, setShowPreview] = useState(false);
  return (
    <>
      <button onClick={() => setShowPreview(true)}>Preview</button>
      {showPreview && <PDFViewer src={doc.url} />}
    </>
  );
}
```

**After:**
```tsx
const PDFViewer = dynamic(() => import("heavy-pdf-lib").then(m => m.PDFViewer), {
  loading: () => <Skeleton className="h-96" />,
});
```
The 300KB dependency now only loads when the user actually clicks
"Preview," not on every visit to the page.

---

#### Example 2 — Debounced search instead of per-keystroke fetch

**Before:**
```tsx
function Search() {
  const [query, setQuery] = useState("");
  useEffect(() => { fetchResults(query); }, [query]); // fires on every keystroke
  return <input value={query} onChange={e => setQuery(e.target.value)} />;
}
```

**After:**
```tsx
function Search() {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 300);
  useEffect(() => { if (debounced) fetchResults(debounced); }, [debounced]);
  return <input value={query} onChange={e => setQuery(e.target.value)} />;
}
```

---

#### Example 3 — Fixing the re-render source instead of memoizing around it

**Before (works, but re-renders the whole list on every keystroke
because `items` is filtered inline in the parent that also owns the
input's state):**
```tsx
function ProductPage() {
  const [query, setQuery] = useState("");
  const filtered = products.filter(p => p.name.includes(query)); // new array every render
  return (
    <>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <ProductGrid items={filtered} /> {/* re-renders every keystroke regardless */}
    </>
  );
}
```

**Reasonable fix — memoize the derived value since it's a real
computation over a real list, not a reflexive wrap:**
```tsx
const filtered = useMemo(
  () => products.filter(p => p.name.includes(debouncedQuery)),
  [products, debouncedQuery]
);
```
Combined with Example 2's debounce, this now only recomputes and
re-renders after the user pauses typing, not on every keystroke.

---

#### Example 4 — Reserving space for a web font to prevent CLS

**Before (fallback font metrics differ noticeably from the web font,
causing a visible reflow when it swaps in):**
```css
body { font-family: "Custom Sans", sans-serif; }
```

**After (Next.js `next/font` handles fallback metric matching and
`font-display` automatically):**
```tsx
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"], display: "swap" });

<html className={inter.className}>
```
If not using `next/font`, manually specify a `size-adjust`-matched
fallback stack to minimize the visual jump on swap.

---

#### Example 5 — Server-fetching instead of a client waterfall

**Before:**
```tsx
"use client";
function Dashboard() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  useEffect(() => { getUser().then(setUser); }, []);
  useEffect(() => { if (user) getStats(user.id).then(setStats); }, [user]); // waterfall: waits for user first
  if (!user || !stats) return <Skeleton />;
  return <DashboardView user={user} stats={stats} />;
}
```

**After (parallel server-side fetch, no client waterfall, no loading
skeleton needed for the initial render):**
```tsx
async function Dashboard() {
  const [user, stats] = await Promise.all([getUser(), getStats()]); // parallel, on the server
  return <DashboardView user={user} stats={stats} />;
}
```

---

## website-review

> Run a full pre-ship review of a project/page/PR across pixel-perfect accuracy, responsive behavior, accessibility, performance, animation quality, design consistency, and code quality — producing a concrete, prioritized findings list, not a vague approval. Use when: "review this before I ship", "is this ready", "do a full review", "check everything", "final QA pass", right before a feature/page is considered done. NOT for: implementing the fixes it finds (route those to the specific skill that owns each area) or a narrow single-concern review (use the specific skill directly — e.g. accessibility only).

### Website Review

The final gate before calling a page or feature done: a structured
audit across every quality dimension the other skills in this pack
each own individually, producing specific, actionable findings.

#### Objective

Systematically check a completed section, page, or PR against seven
dimensions — pixel-perfect accuracy, responsive behavior,
accessibility, performance, animations, design consistency, and code
quality — and report concrete, prioritized findings (with file/line
references where applicable), not a vague "looks good" or an
unfocused wall of minor nitpicks.

#### Scope

- A pre-ship review of a specific page, feature, or PR diff.
- Draws on the standards defined by the other 11 skills in this
  pack (figma-pixel-perfect, responsive-layout, accessibility,
  performance, image-optimization, ui-animation, micro-interactions,
  premium-ui, design-system, tailwind-expert, react-architecture) as
  its checklist source, rather than redefining those standards here.
- Does not itself implement fixes — reviews and reports; fixes get
  routed to (or done using) the relevant specific skill.

#### Rules

1. **Review against the actual standards, not general impression.**
   Each dimension below has a specific skill in this pack defining
   what "correct" means — use those definitions, don't substitute
   personal taste for a documented rule.
2. **Findings must be specific and actionable.** "Accessibility could
   be better" is not a finding. "The delete button at
   `ProductRow.tsx:42` is a `<div onClick>` with no keyboard support
   — convert to `<button>`" is a finding.
3. **Prioritize findings.** Separate blocking issues (accessibility
   failures, broken responsive layout, real performance regressions,
   visual mismatches from a Figma spec) from lower-priority polish
   (a slightly inconsistent shadow value) — don't present them with
   equal weight.
4. **Verify, don't assume, when tooling allows.** If browser
   automation, a live dev server, or the Figma MCP tools are
   available, use them to actually check rendered output, keyboard
   traversal, and design-value accuracy — state plainly when a check
   is reasoning-based instead because verification tooling wasn't
   available, rather than presenting an inference as a confirmed
   check.
5. **Don't rubber-stamp.** A review that finds zero issues on a
   nontrivial page is a signal to look harder, not a badge of
   success — cross-check each of the seven dimensions explicitly
   before concluding there's nothing to flag in it.
6. **Scope the review to what's realistic to change.** Flag findings
   with their fix cost in mind (a one-line contrast fix vs. a
   structural re-architecture) so the user can triage what to
   address before shipping vs. track as follow-up.
7. **Re-review after fixes**, don't assume a reported fix actually
   resolved the finding — confirm it, especially for anything
   automatically-verifiable.

#### The Seven Dimensions

1. **Pixel-perfect accuracy** (`figma-pixel-perfect`) — if a Figma
   spec exists, does the implementation match its real extracted
   values? Flag any value that was estimated rather than sourced.
2. **Responsive behavior** (`responsive-layout`) — does the layout
   hold up across the full viewport range, not just standard
   breakpoints? Any overflow, clipping, or broken reflow at
   in-between widths?
3. **Accessibility** (`accessibility`) — semantic HTML, keyboard
   operability, focus visibility, contrast, ARIA correctness, motion
   safety, live regions for dynamic content.
4. **Performance** (`performance`, `image-optimization`) — bundle
   size red flags, unnecessary client-side fetching, un-optimized
   images, missing loading strategy on the LCP element, layout shift
   risk.
5. **Animations** (`ui-animation`, `micro-interactions`) — 60 FPS-safe
   properties animated, reduced-motion handled, appropriate
   duration/easing, no missing feedback states on interactive
   elements.
6. **Design consistency** (`premium-ui`, `design-system`,
   `tailwind-expert`) — tokens used consistently, no duplicated
   near-identical components, visual hierarchy clear, spacing/type
   scale respected.
7. **Code quality** (`react-architecture`) — component boundaries
   sensible, no unnecessary client-side boundaries, state placed
   appropriately, no dead code left from iteration.

#### Workflow

1. **Establish scope** — which page(s)/component(s)/diff is under
   review, and whether a Figma spec exists to check dimension 1
   against.
2. **Gather verification tooling availability** — is a live dev
   server reachable, is browser automation connected, is the Figma
   MCP available for the relevant file? State what's available before
   starting, since it determines how much of the review can be
   directly verified vs. reasoned from source.
3. **Walk each of the seven dimensions explicitly**, checking against
   its owning skill's checklist, not from memory/impression.
4. **Record findings** with: dimension, specific location
   (file/line or visual location), concrete description of the
   issue, and severity (blocking vs. polish).
5. **Prioritize and summarize** — lead with blocking issues, group
   polish items separately, and note anything that couldn't be
   verified due to missing tooling.
6. **If fixes are requested**, apply them using the relevant specific
   skill for that dimension, then re-verify the specific finding is
   resolved — don't mark it done from memory.

#### Examples

**Well-formed finding**
> **[Blocking — Accessibility]** `AboutHero.tsx:52` — the "Reserve A
> Table" trigger is a `<div onClick>` with no `tabIndex`/keyboard
> handler. Convert to a `<button>` or `<a>` depending on whether it
> navigates or triggers in-page state. (See `accessibility` skill,
> Rule 1/3.)

**Well-formed finding**
> **[Polish — Design consistency]** `PopularMenu.tsx:26` and
> `OurStory.tsx:63` both hand-roll the same CTA button markup with
> minor drift (one uses `rounded-lg`, the other `rounded-tl-[8px]...`
> asymmetric radii). Consolidate into one `Button` component per
> `design-system` skill's consolidation rule.

**Poorly-formed finding (avoid this)**
> "The accessibility here isn't great, might want to look at it."
— No location, no specific issue, no actionable next step.

**Stating verification limits honestly**
> Browser automation isn't connected this session, so responsive
> behavior below was reasoned from the CSS/Tailwind classes rather
> than confirmed by resizing a live viewport — flagging as
> lower-confidence; recommend a manual check before shipping.

#### Common Mistakes

- Producing a vague "looks good overall" summary without walking
  each dimension explicitly.
- Treating every finding as equally urgent, burying real blockers
  among minor polish notes.
- Presenting a reasoning-based check as if it were a confirmed,
  tooling-verified one.
- Re-reviewing only the dimensions that had issues last time,
  skipping the others on the assumption they're still fine.
- Reviewing against personal taste instead of the specific rules the
  other 11 skills in this pack define.
- Marking a reported fix as resolved without re-checking it.

#### Best Practices

- Use actual tooling (dev server, browser automation, Figma MCP)
  whenever available rather than defaulting to static code reading.
- Keep the seven-dimension structure explicit in the output so it's
  scannable — a reader should be able to jump to "Accessibility" and
  see exactly what was checked and found.
- Separate "must fix before shipping" from "worth tracking as a
  follow-up" clearly.
- When a dimension genuinely has no findings, say so explicitly
  rather than omitting it — silence reads as "not checked."

#### Anti-patterns

- ❌ A one-paragraph "ship it, looks solid" review with no dimension
  breakdown.
- ❌ Flagging 40 equally-weighted nitpicks with no prioritization,
  making the real blockers hard to find.
- ❌ Claiming a Figma pixel-match was verified when no Figma access
  was actually available for this review.
- ❌ Skipping accessibility or performance because "it's just a
  content page" without actually checking.

#### Checklist

- [ ] Review scope and available verification tooling stated upfront
- [ ] All seven dimensions explicitly walked, not skipped or assumed
- [ ] Every finding has a specific location and concrete description
- [ ] Findings prioritized (blocking vs. polish)
- [ ] Reasoning-based checks clearly distinguished from
      tooling-verified ones
- [ ] No dimension silently skipped without being stated as such
- [ ] Any applied fixes re-verified, not assumed resolved

#### Success Criteria

- A reader can act on the review directly — every finding is
  specific enough to fix without asking "where?" or "what exactly?"
- Blocking issues are unambiguous and separated from optional polish.
- The review's confidence level (verified vs. reasoned) is honestly
  represented per finding.
- Running the review again after fixes are applied shows those
  specific findings resolved.

### website-review: examples

#### Example — Full sample review output

Scope: `AboutHero.tsx` + `PopularMenu.tsx` (About page hero and menu
section), pre-ship review.
Tooling available: local dev server reachable via curl; no browser
automation connected this session; no Figma URL provided for this
specific review.

---

##### 1. Pixel-perfect accuracy — ⚠️ Not verifiable this pass

No Figma URL was supplied for this review scope, so this dimension
is unchecked rather than passed. If a spec exists, share the
`node-id` URL to verify against real values.

##### 2. Responsive behavior — 1 finding

- **[Blocking]** `PopularMenu.tsx:22` — the dish grid uses
  `grid-cols-2 md:grid-cols-4` with no intermediate step; at ~700-900px
  (a common tablet width) two very wide cards result, looking
  unintentionally sparse. Consider a 3-column step at `sm:` or
  switching to `grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))`
  per the `responsive-layout` skill's content-driven grid guidance.

##### 3. Accessibility — 2 findings

- **[Blocking]** `AboutHero.tsx:57` — the social/nav icon links in
  the badge row have no `aria-label`; the icon alone (an SVG with no
  title) provides no accessible name. Add `aria-label="..."` per
  icon.
- **[Polish]** `Footer.tsx` newsletter input has a placeholder
  ("Your email...") but no associated `<label>` — add a visually
  hidden label for screen reader users per the `accessibility`
  skill's Rule 11.

##### 4. Performance — no findings

Images use `next/image` with `fill`/`object-cover` throughout; no
`priority` over-use observed (only the hero bowl image is marked, and
it's plausibly this page's LCP element). No client-side data fetching
present on this static content.

##### 5. Animations — no findings

No animation present in this scope beyond CSS `transition-colors` on
hover states, which is appropriately minimal for these components.

##### 6. Design consistency — 1 finding

- **[Polish]** `PopularMenu.tsx:42` and `OurStory.tsx:63` both
  hand-roll the same CTA button markup with minor radius drift.
  Recommend consolidating into one `Button` component per the
  `design-system` skill.

##### 7. Code quality — no findings

Component boundaries are reasonable; no unnecessary `"use client"`
directives found in this static-content scope.

---

**Summary: 2 blocking findings, 2 polish findings, 1 dimension
unverifiable (no Figma URL provided).** Recommend fixing the two
blocking items before shipping; polish items can be tracked as
follow-up.

---

#### Example — Well-formed vs. poorly-formed findings

**Poorly-formed:**
> "Some accessibility issues, and the grid could be better on
> tablet."

**Well-formed (the actual findings above):**
> **[Blocking]** `AboutHero.tsx:57` — icon-only links have no
> `aria-label`, no accessible name for screen readers. Fix: add
> `aria-label` per icon link.
>
> **[Blocking]** `PopularMenu.tsx:22` — grid jumps 2→4 columns with
> no intermediate step, producing oversized cards at ~700-900px
> viewports. Fix: add a 3-column breakpoint or switch to
> `auto-fit`/`minmax`.

The well-formed version tells the reader exactly where to go and
what to do, without requiring a follow-up question.

---

#### Example — Honest verification-confidence statement

> Browser automation wasn't connected this session, so the
> responsive-behavior findings above are based on reading the
> Tailwind breakpoint classes in source, not on actually resizing a
> live viewport. This is lower-confidence than a direct visual check
> — recommend a quick manual resize test before shipping, particularly
> around the 700-900px range flagged above.

This is preferable to silently presenting the same finding as if it
had been confirmed in a live browser.
