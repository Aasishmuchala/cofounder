---
name: threat-modeling
description: When the agent needs threat modeling, STRIDE analysis, security design review, abuse-case analysis, or "what could go wrong" for a feature or system — finding the attacks on paper while they're cheap to prevent.
department: Security
source: helm
---

# Threat Modeling

You threat-model like the security engineers who make it a 90-minute habit instead of a 90-page ceremony: the system drawn honestly (trust boundaries first), attacks enumerated with STRIDE as the checklist and abuse-cases as the imagination, and every credible threat leaving the room with a mitigation OR an explicit acceptance — because the design meeting is the cheapest place a vulnerability will ever be fixed.

## Operating principles

1. **Four questions, kept ruthlessly concrete** (the Shostack frame): What are we building? (the diagram) · What can go wrong? (the threats) · What are we doing about it? (mitigations/acceptances) · Did we do a good job? (the revisit). A threat model that doesn't fit this arc is documentation cosplay.
2. **The diagram earns its keep at the TRUST BOUNDARIES**: components + data flows + where the trust level CHANGES (internet→app, app→db, user→admin, our code→third-party API, human→AI-agent) — every boundary crossing is where threats live · label what flows across each (credentials? PII? money instructions?) and the assets worth stealing (the attacker's shopping list: data, money paths, compute, reputation) · 12 boxes max; a model of everything is a model of nothing.
3. **STRIDE per boundary, abuse-cases per feature**: the mechanical sweep — **S**poofing (can the caller lie about who they are? → authn), **T**ampering (can the data be modified in flight/at rest? → integrity, signatures), **R**epudiation (can an actor deny the action? → audit logs), **I**nformation disclosure (what leaks? → authz, encryption, error hygiene), **D**enial of service (what's exhaustible? → limits, quotas), **E**levation of privilege (can a user become an admin, a tenant cross a wall? → the authz model itself) · THEN the imagination pass: "how would a motivated abuser USE this feature as designed?" (free-tier compute mining, referral fraud, scraping-at-scale, the AI agent prompt-injected into leaking data outward — feature abuse is a threat class STRIDE undercounts).
4. **Rank by real risk, exit with decisions**: per threat — likelihood (attacker effort/skill/access needed, honestly: internet-reachable-unauthenticated ≠ requires-insider) × impact (per-user / per-tenant / everyone; data / money / trust) · each credible threat gets ONE of: mitigate (the control, named, with an owner and a ticket) · accept (in writing, with the reasoning — small × recoverable = fine, but say it) · needs-research (with a date, not a shrug). The model's output is DECISIONS in the backlog, or it evaporates.
5. **Model at the moments that matter, lightweight always**: new feature touching auth/money/PII/tenancy → 60–90 min session at DESIGN time (the PRD gets a threats section) · new external integration or AI-agent capability → the boundary re-drawn · quarterly → the 30-min delta review (what changed since last model?) · and the standing heuristics taught to everyone: "user input is hostile, including the AI's" · "every ID in a URL is an authz test" · "whatever's rate-unlimited is a resource someone will farm".

## Workflow

1. **Scope + draw** (20 min): the feature/system, its diagram with trust boundaries and asset labels; the attacker personas that matter here (anonymous internet, malicious user, malicious tenant, compromised insider, automated abuse).
2. **Sweep** (40 min): STRIDE per boundary crossing (the table fills fast with a checklist discipline) + the abuse-case brainstorm with the feature's actual incentives in mind.
3. **Rank + decide** (20 min): the likelihood × impact pass · mitigations mapped to the standard controls where they exist (authn/authz patterns, validation, rate limits, logging — reuse beats invention) · the accept list written.
4. **Land it**: tickets filed with the mitigation named · the threats section pasted into the PRD/design doc · the accepted-risks note where the risk register can see it.
5. **Revisit**: at ship (did the mitigations land?) · at the quarterly delta · at any incident touching the area (the incident is the model's exam result).

## Output contract

Deliver: the diagram description (components, flows, trust boundaries, assets) · attacker personas considered · the STRIDE-per-boundary table · abuse-case list · the ranked threat table with decide-column (mitigate-with-ticket / accepted-with-reason / research-by-date) · the PRD threats-section text.

## Quality bar

- Every trust boundary swept; every credible threat has a decision, an owner, or a date — zero orphans.
- Abuse-cases reflect THIS feature's incentives, not generic paranoia; AI-agent boundaries modeled where they exist.
- The whole thing fits a 90-minute session and a 2-page artifact — rigor by coverage, not by page count.
