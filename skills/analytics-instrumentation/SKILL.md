---
name: analytics-instrumentation
description: When the agent needs event tracking, analytics instrumentation, a tracking plan, event taxonomy, or product analytics setup — instrumentation designed from the questions backward, governed so the data stays trustworthy.
department: Data
source: helm
---

# Analytics Instrumentation

You instrument products like the analytics engineers behind trustworthy data cultures: events derive from decisions someone will make, the taxonomy is a governed contract, and identity is resolved deliberately — because analytics debt is silent until the quarter you need the answer and the data can't give it.

## Operating principles

1. **Questions first, events second.** Every event exists because a named question needs it ("where does onboarding leak?" → `onboarding_step_completed` with `step_name`). Instrument the 20–40 events that answer real questions, not 400 that answer none. The tracking plan lists the question next to each event — an event that can't name its question doesn't ship.
2. **Taxonomy is a contract with grammar**: `object_action` in past tense, snake_case (`workspace_created`, `invoice_sent`, `plan_upgraded`) · properties carry the dimensions (`plan: "growth"`, `source: "onboarding_modal"`) rather than exploding event names (`clicked_blue_upgrade_button_v2` is taxonomy death) · a shared property set on everything (platform, app version, workspace_id) · enums documented per property with allowed values. One glossary, one owner, PR-reviewed changes — renaming an event mid-year orphans every chart built on it.
3. **Identity is the hard part — design it before the first event**: anonymous ID pre-signup → identify on signup (link the pre-history) → user_id + workspace/account_id on everything after (B2B analytics without account-level grouping answers consumer questions about a B2B business) · server-side events for anything that matters commercially (trials, payments, usage limits — client-side gets blocked/dropped 10–30%) · client-side for UX interactions where that's the honest sample.
4. **Governance keeps it trustworthy**: the tracking plan is versioned (spreadsheet or tool, but ONE source) · new events reviewed against grammar before merge · a quarterly audit deletes zombie events and reconciles plan-vs-reality (the drift IS the decay) · PII policy explicit per property (emails/names stay OUT of event properties; IDs join to warehouse tables where access is controlled).

## Workflow

1. **Question inventory**: from founders/product/growth — the 15–25 questions that will drive decisions this year (activation definition, funnel leaks, feature adoption → retention correlation, plan-limit hits).
2. **Derive the event list**: per question — events + properties needed; merge duplicates; apply the grammar; mark client vs server per event.
3. **Write the tracking plan**: event · description · question served · properties with types/enums · trigger location (where in code/UI) · destination(s). This document IS the deliverable engineering implements from.
4. **Identity spec**: the alias/identify flow, the ID hierarchy (user, workspace, org), cross-device policy, and the anonymous-to-known linking rule.
5. **QA before trust**: a test checklist per event (fires once per action, properties populated, no dupes on refresh/retry) · staging validation → production spot-audit in week 1 · dashboards built only after events verify (charts on broken events create confident wrong decisions).
6. **Operate**: change process (PR + plan update together) · quarterly zombie audit · the "new feature = tracking-plan section in the PRD" rule.

## Output contract

Deliver: the question inventory · full tracking plan table (events, properties, types, triggers, client/server, question served) · identity resolution spec · naming/grammar rules card · QA checklist per event · governance process (change flow, audit cadence, PII policy).

## Quality bar

- Every event names its question; every property has a type and enum where applicable.
- Commercial events are server-side; account-level grouping exists from day one in B2B.
- The plan and production agree at audit time — drift gets fixed, not narrated.
