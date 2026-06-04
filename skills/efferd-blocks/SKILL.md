---
name: efferd-blocks
description: Production-ready shadcn/ui block library from efferd.com for React / Next.js frontends. Use when building a shadcn-based UI and you need ready-made, responsive sections instead of hand-coding them — auth pages, hero sections, feature grids, dashboards, app shells, headers/navbars, footers, CTAs, pricing, FAQs, contact, logo clouds, integrations. Install a block with `npx shadcn@latest add @efferd/<block>`. Triggers on "add an auth page", "hero section", "feature section", "pricing section", "dashboard layout", "app shell", "navbar / header", "footer", "CTA section", "FAQ section", "contact section", "logo cloud", "shadcn block", "landing page sections", "use efferd".
---

# efferd — shadcn/ui blocks

[efferd.com](https://efferd.com) — "Beautiful shadcn/ui Blocks for Busy & Smart devs." 100+ pre-built, responsive UI **blocks** delivered through the shadcn registry. The code is copied **into your project** (it lives in your repo, not `node_modules`), so you own and edit it like any other component.

## When to use this
- You are building a **React / Next.js** app that uses (or can use) **shadcn/ui + Tailwind**, and you want production-grade sections fast.
- Reach for efferd BEFORE hand-coding a hero, auth page, pricing table, header, footer, dashboard shell, etc.

## When NOT to use this
- Plain static HTML / inline-CSS pages, emails, or any non-React surface — efferd blocks are shadcn React components and need a build step. (For pure-CSS motion in those, use the `transitions-dev` skill instead.)
- A project with no shadcn/ui set up and no appetite to add it.

## Prerequisites
A project with **Tailwind CSS** and **shadcn/ui** initialized:

```bash
npx shadcn@latest init      # once per project, if not already set up
```

## Install a block

```bash
npx shadcn@latest add @efferd/auth-1
```

This pulls the block's source into your components (e.g. `components/auth-page.tsx`) using the `@efferd` registry namespace. Swap `auth-1` for any block id, then customize the copied code.

## Block catalog (categories → count)

| Category | Blocks | Typical use |
| --- | --- | --- |
| **Auth** | 14 | sign-in / sign-up / reset pages |
| **Hero Sections** | 9 (+3 free) | landing-page hero |
| **Features** | 10 | feature grids / highlights |
| **Dashboard** | 10 | analytics / admin dashboards |
| **App Shell** | 10 | sidebar + topbar app frame |
| **Header** | 14 | marketing / app navbars |
| **Footer** | 14 | site footers |
| **Call to Action** | 20 | CTA bands |
| **Integrations** | 12 | logo / integration grids |
| **Logo Cloud** | 11 | "trusted by" rows |
| **FAQs** | 8 | accordion FAQ sections |
| **Contact** | 11 | contact forms / blocks |

Browse exact block ids + live previews at **https://efferd.com** (and **/docs**). Don't invent block ids — confirm the id on the site before running `add`.

## Free vs. premium
Some blocks are **free** (e.g. 3 of the hero sections); the **full catalog requires a paid plan** (see efferd.com/pricing — "Get full Access"). If `add` fails for a premium block, it needs access. Prefer a free block, or ask the user to provide their efferd access before installing premium ones.

## Workflow
1. Identify the section you need (hero, auth, pricing, header, footer, …).
2. Find the exact block id on efferd.com.
3. `npx shadcn@latest add @efferd/<block>`.
4. Wire it into the page and **customize the copied code** (copy, content, tokens) to the project's brand — it's yours now.
5. Keep it accessible and responsive (the blocks ship responsive; preserve that).

## Notes
- Registry namespace: `@efferd/<block>`. No extra `components.json` registry entry is required for the documented command.
- Pairs well with `transitions-dev` (add polished CSS micro-transitions to the installed blocks).
