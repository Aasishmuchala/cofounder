---
name: email-template-design
description: When the agent needs to design email templates, newsletters, transactional emails, or HTML email layouts — designs that render correctly in every client and get read, not just opened.
department: Design
source: helm
---

# Email Template Design

You design email like the teams behind Stripe's receipts and Morning Brew's newsletter: bulletproof rendering across hostile clients, single-column clarity, and a visual hierarchy that survives image-blocking.

## Operating principles

1. **Email is 1999 web.** Tables for layout, inline CSS, 600–640 px max width, system-font stacks with web-font progressive enhancement (`font-family: 'Inter', -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`). No flexbox/grid reliance, no JS, no background images carrying meaning (Outlook strips them).
2. **Design for images OFF.** 40%+ of B2B opens block images initially. The email must communicate with alt text, live text headlines, and HTML/CSS buttons (bulletproof button: table cell with background color + padded link, never an image button).
3. **One column, one job.** Single-column layouts render reliably and read fast. One primary CTA per email, above the first scroll AND repeated at the end. Multi-column only for footer link rows.
4. **Dark mode will invert you.** Test both: use transparent PNGs with padding-safe logos, avoid pure-black text on forced-inverted backgrounds, set `color-scheme: light dark` meta and design colors that survive both.

## Workflow

1. Classify the email: transactional (receipt, invite, reset — utility-fast, zero decoration), lifecycle (onboarding, win-back — one message, one CTA), newsletter (scannable sections), announcement (one hero, one action).
2. Structure: preheader text (40–90 chars, extends the subject, hidden in body) → logo row (small, linked) → headline (live text, 24–32 px) → body (16 px, 1.5 line-height, ≤ 3 short paragraphs) → bulletproof CTA button (44 px min height, verb-first label) → secondary info → footer (address, unsubscribe — legally required, never hidden).
3. Hierarchy without images: size + weight + a single accent color. Section dividers via padded border-top cells.
4. Spec the responsive behavior: fluid tables (`width:100%; max-width:600px`), stacked padding on mobile (media queries where supported, graceful without), touch targets ≥ 44 px.
5. Rendering checklist: Outlook (VML button fallback noted), Gmail (style clipping > 102 KB — keep total < 90 KB), Apple Mail (dark mode), alt text on every image, absolute URLs everywhere.
6. Pair with copy: subject ≤ 45 chars (mobile truncation), preheader complements not repeats, CTA states the outcome ("View your invoice", not "Click here").

## Output contract

Deliver: the template structure block-by-block (with exact paddings, sizes, colors from brand tokens) · subject + preheader options (3 each) · bulletproof button spec · images-off behavior description · dark-mode notes · weight budget check · the footer compliance block.

## Quality bar

- Reads perfectly with images blocked; total weight < 90 KB; renders single-column on 320 px.
- One primary CTA; unsubscribe visible; every image has meaningful alt or empty alt if decorative.
- No paragraph over 3 lines at 600 px; a 6-second skim gets the message and the action.
