---
name: roadmap-prioritization
description: When the agent needs to prioritize a roadmap, rank features, run RICE or ICE scoring, sequence quarters, or say no with a straight face — allocation of scarce engineering weeks to maximum outcome.
department: Product
source: helm
---

# Roadmap & Prioritization

You prioritize like the PMs who ship compounding products: outcomes over feature lists, scoring as a conversation-forcer (not a truth machine), and sequencing that respects dependencies and risk.

## Operating principles

1. **Prioritize outcomes, then solutions.** First allocate the quarter across OUTCOMES (e.g. 40% activation, 30% revenue expansion, 20% reliability, 10% strategic bets). Then rank solutions WITHIN each bucket. Ranking activation work against infra work in one flat list produces incoherent mush.
2. **RICE honestly**: Reach (users/quarter actually touched) × Impact (3 massive / 2 high / 1 medium / 0.5 low / 0.25 minimal — on the OUTCOME metric) × Confidence (100% shipped-similar-before / 80% strong evidence / 50% educated guess — anything below 50% means "go do discovery, not roadmap") ÷ Effort (person-weeks, engineering's number not yours). The score opens arguments; it never closes them. A 10× score gap is signal; a 1.3× gap is noise — decide those on strategy.
3. **Three horizons stay funded**: Now (this quarter, committed, sized) · Next (1–2 quarters, directional, roughly sized) · Later (thematic, unsized). Publishing dates for "Later" items is how trust dies.
4. **The cost of saying yes is everything you said no to.** Every accepted item names what it displaced. A roadmap without a visible graveyard isn't prioritized — it's accumulated.

## Workflow

1. **Collect candidates** from all pipes: discovery outputs, sales blockers (with $ attached), support themes (with ticket counts), tech investments (with interest evidence), strategy bets.
2. **Bucket by outcome**; set the quarter's allocation percentages with leadership ONCE — this is the actual strategy decision.
3. **Score within buckets** (RICE); pressure-test the top 3 per bucket: what evidence backs Impact? Has engineering sized Effort? What's the riskiest assumption and can a 1-week test de-risk it first?
4. **Sequence**: dependencies first (platform work that unblocks 3 features precedes them), risk-first within big bets (the killable part early), one big-rock-per-team at a time (parallel big rocks = nothing ships).
5. **Publish two views**: internal (outcome buckets, items, owners, confidence) and external/stakeholder (themes + Now/Next/Later, no dates beyond Now).
6. **Re-plan on cadence, not on noise**: mid-quarter check (kill/accelerate based on new evidence); full re-rank quarterly. An escalation between cycles must displace a NAMED item — "just squeeze it in" is banned.

## Output contract

Deliver: outcome allocation table · scored candidate table per bucket (with evidence notes) · the sequenced Now list with owners · Next/Later themes · the displaced list (what got cut and why) · the one-slide stakeholder view.

## Quality bar

- Every Now item: sized by engineering, confidence ≥ 50%, tied to an outcome metric.
- Nothing enters mid-quarter without a named casualty.
- The roadmap answers "why this, why now, why not that" for its top 5 items without a meeting.
