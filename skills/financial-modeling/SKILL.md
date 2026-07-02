---
name: financial-modeling
description: When the agent needs a financial model, revenue model, DCF valuation, three-statement model, driver-based forecast, or startup financial projections — models built on operational drivers where every number traces to an assumption.
department: Finance
source: helm
---

# Financial Modeling

You build models like a top-tier startup CFO: driver-based (numbers flow from operational reality, not typed-in hockey sticks), auditable (every cell traces to an assumption you can argue about), and honest (the model exists to find where the plan breaks, not to decorate a deck).

## Operating principles

1. **Drivers, not outputs.** Revenue is never typed — it's computed: leads × conversion × ACV (sales-led) or visitors × signup × activation × paid-conversion × ARPA (PLG) or units × price × repeat-rate (commerce). If someone challenges month-14 revenue, the answer is an assumption cell, not a shrug.
2. **The assumptions sheet is the model.** One tab, every assumption labeled with: value, unit, source (actuals / benchmark / founder guess — marked honestly), and last-reviewed date. Growth assumptions decay toward maturity (no 15% MoM forever — taper to market-growth rates by year 3). Benchmarks as sanity rails: SaaS gross margin 75–85%, sales-led CAC payback 12–18 mo, PLG 6–12 mo, logo churn SMB 3–5%/mo vs enterprise <1%/mo — deviations allowed but ANNOTATED.
3. **Three statements when cash timing matters; P&L+cash always.** Startups die of cash, not accounting losses: model collections timing (annual-prepay vs monthly changes runway by quarters), payroll as the real line (fully-loaded: salary × 1.25–1.4), and show the cash-out month in bold. A DCF for an early startup is theater — use it only for mature cash flows; early-stage value is negotiated, not discounted.
4. **Scenarios are structural, not ±10% garnish**: Base (current trajectory evidence) · Upside (2–3 named things go right) · Downside (growth halves, one big customer churns, raise slips 6 months). Each scenario answers: cash-out date, headcount affordability, milestone reachability. The downside case is the one that earns you sleep.

## Workflow

1. **Frame**: what decision does this model serve (raise sizing? hiring plan? pricing change?) — it determines granularity (monthly for 24 mo, quarterly beyond; weekly cash only in emergencies).
2. **Choose the revenue engine(s)** and lay the driver tree; wire actuals for elapsed months (the model must reconcile to reality before it may speculate).
3. **Cost architecture**: headcount plan by role × start month (the dominant cost — model hiring lead time), COGS/infra as % of revenue with scale breaks, S&M split into experiments-vs-proven channels, G&A as the boring floor.
4. **Cash mechanics**: collections lag, prepay mix, payables timing, one-off items (deposits, legal, equipment) → monthly cash line → runway = months to zero at each scenario.
5. **Outputs page** (the only page most readers see): ARR trajectory, burn multiple (net burn ÷ net-new ARR — <1.5 good, >2.5 alarming), CAC payback, rule-of-40 when relevant, cash-out per scenario, the 3 assumptions the outcome is most sensitive to (found by actually flexing them ±30%).
6. **Stress-test**: which single assumption flip kills the company? State it on the outputs page. Investors trust models that show their own fragility.

## Output contract

Deliver: assumptions sheet (labeled, sourced) · driver tree per revenue engine · monthly P&L + cash for 24–36 mo · scenario table (base/up/down: cash-out, ARR, headcount) · outputs page with the sensitivity trio · reconciliation note against actuals · the "what kills us" sentence.

## Quality bar

- Zero hardcoded outputs; every number traces to the assumptions sheet in one hop.
- Actual months reconcile to the real books before forecast months begin.
- The downside scenario is genuinely uncomfortable, and the model survives someone hostile auditing any cell.
