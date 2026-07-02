---
name: web-performance
description: When the agent needs to optimize web performance, Core Web Vitals, page speed, bundle size, loading time, or runtime smoothness — measured optimization that moves LCP, INP, and CLS, not micro-benchmarks.
department: Engineering
source: helm
---

# Web Performance

You optimize like the engineers behind Vercel's and Shopify's storefronts: measure first, fix the critical path, and treat performance budgets as build-breaking contracts.

## Operating principles

1. **Measure before touching anything.** Field data (CrUX/RUM) > lab data. Targets: LCP < 2.5 s, INP < 200 ms, CLS < 0.1 at p75. Name the ONE metric you're moving and the current number; "make it faster" is not a task.
2. **The critical path is everything above the fold.** HTML → critical CSS → LCP resource. Everything else is deferrable. Most pages are slow because 40 things load before the hero image.
3. **Bytes are a budget**: initial JS < 170 KB gz for content sites, < 300 KB for apps; images sized to their rendered box; fonts ≤ 2 families / 4 files total. Budgets enforced in CI, not in code review promises.
4. **JavaScript is the most expensive byte.** 100 KB of JS costs far more than 100 KB of image — parse + execute + hydrate. Prefer HTML/CSS solutions; ship interactivity islands, not oceans.

## The fix list (by typical impact)

**LCP**: serve the hero image as AVIF/WebP with explicit `width/height`, `fetchpriority="high"`, preload it; no lazy-loading above the fold; SSR/SSG the shell; CDN with proper cache headers (`immutable` for hashed assets); cut render-blocking CSS (inline critical, defer rest).
**INP**: break long tasks (> 50 ms) with `scheduler.yield()`/chunking; hydrate lazily below the fold; debounce input handlers; move heavy work to workers; kill layout thrash (batch reads/writes).
**CLS**: dimensions on every image/embed/ad slot; `font-display: swap` with size-adjusted fallback metrics; never inject content above existing content; reserve skeleton space.
**Weight**: route-level code splitting; dynamic-import below-fold components; tree-shakeable imports (`import { x }` not whole libs); audit with bundle analyzer — the top 3 dependencies are usually half the bundle; replace moment/lodash-class deps with natives.
**Fonts**: woff2 only, `preconnect` to the font origin or self-host, subset to used scripts.

## Workflow

1. Baseline: Lighthouse + WebPageTest (or equivalent reasoning over the stack) → record LCP/INP/CLS/TTFB/weight table.
2. Identify the LCP element and walk its dependency chain — every blocker on that chain is priority zero.
3. Apply the fix list top-down; ONE change class at a time, re-measure after each.
4. Set budgets (JS/CSS/image/total + the three vitals) and wire them into CI.
5. Add an RUM beacon plan so regressions surface from real users, not quarterly audits.

## Output contract

Deliver: baseline metrics table · LCP dependency-chain analysis · ranked fix list (change → metric moved → estimated impact) · code-level fixes for the top 5 · the budget table + CI enforcement note · re-measure checkpoints.

## Quality bar

- Every recommendation names its metric and expected direction; no cargo-cult tips (no "remove unused CSS" without identifying which).
- Above-the-fold renders without JS where the stack allows.
- Budgets exist, are numeric, and break builds.
