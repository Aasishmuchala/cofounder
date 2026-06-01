---
name: sales-11x
description: 11x.ai platform help — AI digital workers for revenue operations: Alice (AI SDR for multi-channel outbound via email, LinkedIn, SMS, WhatsApp) and Mike/Julian (AI phone agent for inbound calls, 24/7 qualification, meeting booking). Use when
source: github:sales-skills/sales
---

# 11x.ai Platform Help

## Step 1 — Gather context

If `references/learnings.md` exists, read it first for accumulated platform knowledge.

Ask the user:

1. **What do you need help with?**
   - A) Setting up Alice (AI SDR) for outbound campaigns
   - B) Improving Alice's personalization or reply rates
   - C) Setting up Mike/Julian (AI phone agent)
   - D) CRM integration (Salesforce, HubSpot, Zoho)
   - E) Understanding pricing, contracts, or ROI
   - F) Comparing 11x to other AI SDR tools
   - G) API or webhook integration
   - H) Something else — describe it

2. **Are you an existing customer or evaluating?**
   - A) Active customer — using Alice
   - B) Active customer — using Alice + Mike/Julian
   - C) In trial / proof of concept
   - D) Evaluating — comparing options

3. **What CRM do you use?** (Salesforce, HubSpot, Zoho, other)

**If the user's request already provides most of this context, skip directly to the relevant step.**

## Step 2 — Route or answer directly

| Need | Action |
|---|---|
| 11x-specific config, campaigns, integrations, pricing | Answer directly from Step 3 |
| General outbound cadence design (multi-platform) | Route: `/sales-cadence [question]` |
| Email deliverability strategy (SPF/DKIM/DMARC) | Route: `/sales-deliverability [question]` |
| Building prospect lists beyond 11x's database | Route: `/sales-prospect-list [question]` |
| Contact enrichment from other providers | Route: `/sales-enrich [question]` |
| Meeting scheduling beyond built-in booking | Route: `/sales-meeting-scheduler [question]` |
| Comparing AI SDR tools at a strategy level | Route: `/sales-cadence compare AI SDR platforms for my use case` |

## Step 3 — 11x platform reference

**Read `references/platform-guide.md`** for the full platform reference — capabilities, pricing, API surface, CRM integration, controversies, and comparison to competitors.

Answer the user's question using only the relevant section. Don't dump the full reference.

## Step 4 — Actionable guidance

Based on the user's specific question:

1. **Campaign setup** — configure Alice's ICP targeting, messaging context, channel mix
2. **Personalization** — improve AI Strategist inputs, provide better context signals
3. **Phone agent** — set up Mike/Julian, configure CRM push, tune qualification criteria
4. **Integration** — connect CRM via Ampersand OAuth, use API for custom workflows
5. **Evaluation** — honest comparison against alternatives with pricing context

If you discover a gotcha, workaround, or tip not covered in `references/learnings.md`, append it there.

## Gotchas

*Best-effort from research — review these, especially items about plan-gated features and integration gotchas that may be outdated.*

- **Annual contracts are mandatory and hard to exit.** 11x requires annual commitments (~$60K/yr minimum). Multiple users report inflexible cancellation terms and auto-renewal. Negotiate cancellation windows and performance guarantees before signing.
- **~$5,000/month for ~3,000 contacts is steep.** At ~$1.67/contact, 11x is 5-10x more expensive than AiSDR ($900/mo for similar volume). Ensure the higher automation level and phone agent justify the premium for your use case.
- **"Full autopilot" is overpromised.** Despite the positioning, Alice handles email and LinkedIn only — no phone, no deep research, no strategic selling. Multiple reviewers describe it as "40% of an SDR's job at 100% of the cost." Set expectations accordingly.
- **Phone agent quality is inconsistent.** Mike/Julian struggles with natural conversation, objection handling, and proper qualification according to user reports. Test thoroughly in a proof-of-concept before committing.
- **Personalization can be generic.** Users report Alice's outreach sometimes reads as templated despite "AI personalization." The AI Strategist needs rich context — company docs, value props, specific pain points — to produce quality output.
- **High churn rates reported.** Third-party reports suggest gross retention below 50%, meaning most customers cancel within a year. Request references from customers in your industry before committing.
- **Platform stability concerns.** Users report campaigns breaking, analytics not loading, and integrations failing. Ask about SLA guarantees and support response times.
- **No phone dialer for Alice.** Alice doesn't make calls — you need separate tools (Orum, Nooks, ConnectAndSell) at $200-500/mo extra for phone outreach.

- **Self-improving**: If you discover something not covered here, append it to `references/learnings.md` with today's date.

## Before recommending a specific platform skill

This skill covers a strategy domain across many platforms. **Before pointing the user to any specific platform skill** (any `/sales-{platform}` listed in `## Related skills`, e.g., `/sales-mailshake`, `/sales-klaviyo`, `/sales-apollo`), read that platform skill's actual `SKILL.md` first. The 1-line description in `## Related skills` is enough to *identify* a candidate — it's not enough to *commit* to it or to write a prompt that invokes it well.

**How to read it:**
- If `~/.claude/skills/{skill-name}/SKILL.md` exists locally, `Read` it.
- For `sales-*` skills, `WebFetch` directly from this repo: `https://raw.githubusercontent.com/sales-skills/sales/main/skills/{skill-name}/SKILL.md` — e.g., for `sales-mailshake`: `https://raw.githubusercontent.com/sales-skills/sales/main/skills/sales-mailshake/SKILL.md`.
- For non-`sales-*` skills (third-party), look up `{org}/{repo}` in `~/.claude/skills/sales-do/references/skill-sources.md` if installed and fetch the same `skills/{skill-name}/SKILL.md` path under that repo.

**After reading,** ground your recommendation in something concrete from the SKILL.md (its scope, a sub-flow, its `argument-hint` shape, or a "Do NOT use for..." negative trigger). Align any generated invocation with the platform skill's `argument-hint`. If the platform skill turns out not to fit the user's situation, swap to another or handle the question here directly rather than recommending a poor fit.

## Related skills

- `/sales-aisdr` — AiSDR platform help — AI-powered SDR, HubSpot-native, $900/mo entry
- `/sales-cadence` — Design multi-channel outbound cadences with timing, A/B testing, and content
- `/sales-deliverability` — Email deliverability — SPF/DKIM/DMARC, warmup, inbox placement
- `/sales-prospect-list` — Build targeted B2B prospect lists using multiple data sources
- `/sales-enrich` — Enrich contacts and companies with verified data from multiple providers
- `/sales-nooks` — Nooks platform help — AI parallel dialer, multi-channel sequencing, coaching
- `/sales-orum` — Orum platform help — AI parallel dialer, coaching suite
- `/sales-reply` — Reply.io platform help — multichannel sequences, Jason AI SDR
- `/sales-do` — Not sure which skill to use? The router matches any sales objective to the right skill. Install: `npx skills add sales-skills/sales --skill sales-do -a claude-code`

## Examples

### Example 1: Evaluate 11x vs cheaper alternatives
**User says**: "Is 11x worth $5K/month when AiSDR is $900? What am I actually getting for the extra cost?"
**Skill does**:
1. Reads platform guide for pricing comparison
2. Compares: 11x includes AI phone agent (Mike/Julian), 400M+ contact database, multi-channel (email+LinkedIn+SMS+WhatsApp) vs AiSDR's email+LinkedIn only at lower volume
3. Notes the controversy: high churn, generic personalization reports, annual lock-in
4. Recommends: if you need phone agent + high volume, 11x may justify the cost. If email+LinkedIn is enough, AiSDR at $900/mo or Salesforge Agent Frank at $499/mo are far better value.
**Result**: Honest cost-benefit analysis with clear recommendation

### Example 2: Improve Alice's outreach quality
**User says**: "Alice is sending emails but they sound super generic. How do I make them more personalized?"
**Skill does**:
1. Reviews AI Strategist configuration requirements
2. Recommends enriching context: company-specific value props, industry pain points, case studies, competitive differentiators
3. Suggests narrowing ICP targeting for higher-quality personalization
4. Sets realistic expectations: AI personalization has limits — review and refine output regularly
**Result**: Actionable checklist for improving Alice's message quality

### Example 3: Connect 11x to Salesforce
**User says**: "How do I set up the CRM integration between 11x and Salesforce?"
**Skill does**:
1. Reads platform guide for CRM integration details
2. Walks through Ampersand OAuth connection setup
3. Explains field mapping, required fields (Agent Identifier, E.164 phone format)
4. Notes: create a dedicated "11x user" in Salesforce for activity attribution
**Result**: Working Salesforce integration with proper field mapping

## Troubleshooting

### Alice's emails getting no replies
**Symptom**: High send volume but reply rate near zero
**Cause**: Generic personalization, targeting too broad, or insufficient AI Strategist context
**Solution**: Feed Alice more specific context — exact pain points, competitive wins, customer testimonials. Narrow ICP targeting to a tighter segment. Review the last 20 sent emails for quality — if they read as templates, the AI needs more differentiated input. Consider whether your price point and message-market fit are the issue, not the tool.

### CRM data not syncing back
**Symptom**: Activities from 11x not appearing in Salesforce/HubSpot
**Cause**: OAuth connection expired, field mapping mismatch, or permissions issue
**Solution**: Check the Ampersand connection status in integration settings. Verify the 11x user account has read/write permissions on Contact/Lead objects. Check CRM Request Logs in the 11x dashboard for error details. Re-authorize the OAuth connection if expired.

### Phone agent producing poor outcomes
**Symptom**: Mike/Julian answers calls but fails to qualify leads or book meetings
**Cause**: Insufficient training context, overly complex qualification criteria, or unrealistic expectations
**Solution**: Simplify the qualification script — reduce the number of questions the agent asks. Provide more background context about your product and common objections. Test with internal calls first before going live. Set realistic expectations: AI phone agents are best for simple qualification, not complex discovery calls.
