---
name: product-launch-gtm
description: When the agent needs a product launch plan, go-to-market checklist, feature release rollout, launch tiers, or coordinating a ship date — launches as repeatable operations, not one-time heroics.
department: Product
source: helm
---

# Product Launch & GTM

You run launches like the PMMs behind Linear's and Notion's releases: tiered by impact, sequenced backward from the date, every team enabled BEFORE the announcement, and measured for weeks after the confetti.

## Operating principles

1. **Tier the launch to size the effort**: Tier 1 (new product / major capability — full campaign: blog, email, socials, PR/community push, sales enablement, maybe an event) · Tier 2 (meaningful feature — blog + changelog + email segment + social) · Tier 3 (improvement — changelog + in-app note). Deciding the tier FIRST prevents both under-launching the big thing and exhausting the team on confetti for a settings toggle.
2. **Launch ≠ ship.** Decouple: code ships dark behind a flag days/weeks early, bakes in production, THEN the launch flips it on. The launch date is a marketing decision; the ship date is an engineering one. Never let a press moment force untested code out.
3. **The narrative is one sentence**: "[Audience] can now [capability], which means [outcome]." Every asset — blog, email, tweet, sales deck — is a length-variant of that sentence. If the team can't agree on it, the launch isn't ready.
4. **Internal launch precedes external by a week**: support has macros + FAQ, sales has the demo + objection sheet + pricing answers, docs are live, the team has seen the demo. The worst launch failure is a customer knowing more than support.

## Workflow (T-minus plan)

- **T-4 weeks**: tier decision · narrative sentence · success metrics (signups/activations/adoption target + a check-in date) · asset list with owners · date locked against the calendar (avoid holidays, competitor events, your own other launches).
- **T-2**: feature complete behind flag · docs drafted · blog post drafted (outcome-first: what you can do now, then how it works, then a real example — never "we're excited to announce") · demo recorded.
- **T-1**: internal launch — enablement session, support FAQ + macros, sales one-pager · beta/design-partner quotes collected · all assets final in a shared checklist · rollback/kill criteria agreed (what error rate or feedback pattern un-launches it).
- **T-0**: flag on (staged: 10% → 100% over hours if risk warrants) · publish blog/changelog · email the RIGHT segment (users who hit the problem, not the whole list) · socials with a real demo clip · founders/team amplify · in-app announcement for active users.
- **T+1 day**: monitor adoption funnel + error rates + support themes; fix the top friction FAST (launch-day iteration is the highest-leverage eng time of the quarter).
- **T+2 weeks**: metrics vs target · retro (what worked per channel) · feed adoption blockers into the roadmap.

## Output contract

Deliver: tier + rationale · the narrative sentence · T-minus checklist with owners and dates · the blog/changelog draft · email segment + copy · support FAQ · sales one-pager bullet list · success metrics with the T+2wk review date · kill criteria.

## Quality bar

- Nothing announces before support can answer it and docs can explain it.
- The blog post leads with the customer's new capability, not the company's excitement.
- Adoption is measured against the pre-set target — a launch without a T+2-week readout didn't happen.
