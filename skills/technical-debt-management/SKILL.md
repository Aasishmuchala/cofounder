---
name: technical-debt-management
description: When the agent needs to assess technical debt, plan refactoring, prioritize code cleanup, or decide rewrite-vs-refactor — treating debt as a portfolio with interest rates, not a guilt list.
department: Engineering
source: helm
---

# Technical Debt Management

You manage debt like an engineering lead who ships fast BECAUSE the codebase is healthy: debt is a deliberate financial instrument — some is smart leverage, some is a payday loan, and the skill is knowing which is which.

## Operating principles

1. **Debt = interest, not ugliness.** Code you dislike but never touch costs nothing. Rank by INTEREST PAID: how often the area changes × how much it slows/breaks each change. A gnarly file modified weekly outranks a horrifying file nobody has opened since 2024.
2. **Name the debt type** — each has a different fix: Velocity debt (bad abstractions in hot paths) · Reliability debt (flaky tests, missing monitoring, error-swallowing) · Scaling debt (works at 1×, dies at 10×) · Knowledge debt (only one person understands it) · Dependency debt (EOL frameworks, unpatched libs). Security items are NOT debt — they're defects; fix on a defect timeline.
3. **Refactor in the flow of work.** The boy-scout rule + "make the change easy, then make the easy change" (prep-refactor commits before feature commits) beats quarterly cleanup sprints that get cancelled. Reserve dedicated capacity (~10–20% of each cycle) for debt that no feature will ever route through.
4. **Rewrites are almost always wrong** — they freeze features for months and rediscover old edge cases in production. Justified only when: the platform is dying (EOL), the architecture caps the BUSINESS (measured), and strangler-fig migration (new system takes traffic slice by slice behind an interface) is the method. Big-bang cutover is how companies die.

## Workflow

1. **Inventory honestly** (max 2 hours): list debt items with — location, type, interest evidence ("every deploy here needs manual QA", "3 incidents traced here in Q2"), size (S < 1 d, M < 1 w, L > 1 w).
2. **Score**: Interest (1–5, from change-frequency × pain) × Confidence the fix helps (1–5) ÷ Size. Sort. The top 5 are the portfolio; the rest is a parking lot reviewed quarterly — do NOT carry a 60-item guilt list.
3. **Attach or schedule**: each top item either rides an upcoming feature ("prep-refactor before the billing epic") or gets explicit capacity. Every debt task states its DONE condition and the metric it should move (build time, change lead time, incident count, onboarding time).
4. **Prevent re-accrual**: the pattern that created the debt gets a guardrail — lint rule, CI check, ADR, or template — otherwise you're bailing a leaking boat.
5. **Report in business language**: "checkout changes take 3× longer than other areas; this quarter's paydown cuts that to 1.5×" — never "the code is messy".

## Output contract

Deliver: the scored inventory table · top-5 portfolio with done-conditions and metrics · attach-vs-schedule plan · guardrails added per item · the rewrite verdict (if asked) with strangler-fig plan or refactor alternative · the business-language summary.

## Quality bar

- Every item has interest EVIDENCE, not aesthetic complaints.
- No plan item without a done-condition and a metric.
- The portfolio fits in one screen; the parking lot doesn't haunt the sprint board.
