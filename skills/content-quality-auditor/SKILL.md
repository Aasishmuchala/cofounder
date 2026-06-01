---
name: content-quality-auditor
description: Use when auditing content quality, E-E-A-T, publish readiness, or 内容质量/EEAT评分. Runs 80-item CORE-EEAT scoring with veto checks and fix plan.
source: github:aaron-he-zhu/seo-geo-claude-skills
---

# Content Quality Auditor

> Based on [CORE-EEAT Content Benchmark](https://github.com/aaron-he-zhu/core-eeat-content-benchmark). Full benchmark reference: [references/core-eeat-benchmark.md](https://github.com/aaron-he-zhu/seo-geo-claude-skills/blob/main/references/core-eeat-benchmark.md)

This skill evaluates content quality across 80 standardized criteria organized in 8 dimensions. It produces a comprehensive audit report with per-item scoring, dimension and system scores, weighted totals by content type, and a prioritized action plan.

## When This Must Trigger

Use this when content needs a quality check before publishing — even if the user doesn't use audit terminology:

- User asks "is this ready to publish" or "how good is this"
- User just finished writing with seo-content-writer or content-refresher
- **PostToolUse hook recommendation**: after content is written or substantially edited, the command-backed hook may recommend this audit. When hook-triggered, skip setup questions — audit the content that was just produced.
- Auditing content quality before publishing
- Evaluating existing content for improvement opportunities
- Benchmarking content against CORE-EEAT standards
- Comparing content quality against competitors
- Assessing both GEO readiness (AI citation potential) and SEO strength (source credibility)
- Running periodic content quality checks as part of a content maintenance program
- After writing or optimizing content with seo-content-writer or geo-content-optimizer

## What This Skill Does

1. **Full 80-Item Audit**: Scores every CORE-EEAT check item as Pass/Partial/Fail
2. **Dimension Scoring**: Calculates scores for all 8 dimensions (0-100 each)
3. **System Scoring**: Computes GEO Score (CORE) and SEO Score (EEAT)
4. **Weighted Totals**: Applies content-type-specific weights for final score
5. **Veto Detection**: Flags critical trust violations (T04, C01, R10)
6. **Priority Ranking**: Identifies Top 5 improvements sorted by impact
7. **Action Plan**: Generates specific, actionable improvement steps

## Quick Start

Start with one of these prompts. Finish with a publish verdict and a handoff summary using the repository format in [Skill Contract](https://github.com/aaron-he-zhu/seo-geo-claude-skills/blob/main/references/skill-contract.md).

### Audit Content

```
Audit this content against CORE-EEAT: [content text or URL]
```

```
Run a content quality audit on [URL] as a [content type]
```

### Audit with Content Type

```
CORE-EEAT audit for this product review: [content]
```

```
Score this how-to guide against the 80-item benchmark: [content]
```

### Comparative Audit

```
Audit my content vs competitor: [your content] vs [competitor content]
```

## Skill Contract

**Gate verdict**: **SHIP** (no critical issues, dimension scores above threshold) / **FIX** (issues found but none critical) / **BLOCK** (a critical trust issue failed — see "Critical Issue to Fix" in the report). Always state the verdict prominently at the top of the report using plain language, not item IDs.

**Expected output**: a CORE-EEAT audit report, a publish-readiness verdict, and a short handoff summary ready for `memory/audits/content/`.

- **Reads**: the target content, content type, supporting evidence, and any prior decisions from [CLAUDE.md](https://github.com/aaron-he-zhu/seo-geo-claude-skills/blob/main/CLAUDE.md) and the shared [State Model](https://github.com/aaron-he-zhu/seo-geo-claude-skills/blob/main/references/state-model.md) when available.
- **Writes**: a user-facing audit report plus a reusable summary that can be stored under `memory/audits/content/`.
- **Promotes**: veto items and publish blockers to `memory/hot-cache.md` (auto-saved, no user confirmation needed). Top improvement priorities to `memory/open-loops.md`.
- **Primary next skill**: use the `Next Best Skill` below once the verdict is clear.

## Data Sources

> See [CONNECTORS.md](https://github.com/aaron-he-zhu/seo-geo-claude-skills/blob/main/CONNECTORS.md) for tool category placeholders.

**With ~~web crawler + ~~SEO tool connected:**
Fetch only user-provided or authorized URLs after [SECURITY.md §Scraping Boundaries](https://github.com/aaron-he-zhu/seo-geo-claude-skills/blob/main/SECURITY.md); then extract HTML, schema, links, and competitor content.

**With manual data only:**
Ask the user to provide:
1. Content text, URL, or file path
2. Content type (if not auto-detectable): Product Review, How-to Guide, Comparison, Landing Page, Blog Post, FAQ Page, Alternative, Best-of, or Testimonial
3. Optional: competitor content for benchmarking

Proceed with the full 80-item audit using provided data. Note in the output which items could not be fully evaluated due to missing access (e.g., backlink data, schema markup, site-level signals).

## Decision Gates

When stopping to ask, always: (1) state the specific value and threshold, (2) offer numbered options with outcomes.

**Stop and ask the user when:**
- Content is under minimum word count for its type (blog/guide: 300 words; product/landing page: 150 words; FAQ: fewer than 3 entries with 50+ words each) — state the actual count and offer: (1) expand to minimum, (2) continue audit with Insufficient Data flags, (3) cancel
- Content type cannot be auto-detected — state what you detected and ask to confirm before proceeding
- Content is primarily media (video/image) with minimal text — ask whether to audit transcript, alt text, or skip
- More than 50% of a dimension's items are N/A — name the dimension and ask: (1) provide supplementary data, (2) mark entire dimension as Insufficient Data
- Any veto item triggers — flag it immediately with the item ID and ask: (1) stop for immediate fix, (2) continue full audit and flag in report

**Continue silently (never stop for):**
- Individual Partial scores within a dimension
- Missing SEO tool data (mark items as N/A and continue)
- Low overall score (the report is the deliverable, not a judgment call)
- User not specifying content type (auto-detect and state your assumption)

## Instructions

When a user requests a content quality audit:

### Step 1: Preparation

```markdown
### Audit Setup

**Content**: [title or URL]
**Content Type**: [auto-detected or user-specified]
**Dimension Weights**: [loaded from content-type weight table]

#### Critical Trust Check (Emergency Brake)

| Check | Status | Action |
|-------|--------|--------|
| Affiliate links disclosed | ✅ Pass / ⚠️ CRITICAL | [If CRITICAL: "Add disclosure banner at page top immediately"] |
| Title matches page content | ✅ Pass / ⚠️ CRITICAL | [If CRITICAL: "Rewrite title and first paragraph to match"] |
| Data points are consistent | ✅ Pass / ⚠️ CRITICAL | [If CRITICAL: "Verify all data before publishing"] |
```

If any veto item triggers, flag it prominently at the top of the report and recommend immediate action before continuing the full audit.

### Step 2: CORE Audit (40 items)

Evaluate each item against the criteria in [references/core-eeat-benchmark.md](https://github.com/aaron-he-zhu/seo-geo-claude-skills/blob/main/references/core-eeat-benchmark.md).

Score each item:
- **Pass** = 10 points (fully meets criteria)
- **Partial** = 5 points (partially meets criteria)
- **Fail** = 0 points (does not meet criteria)

```markdown
### C — Contextual Clarity

| ID | Check Item | Score | Notes |
|----|-----------|-------|-------|
| C01 | Intent Alignment | Pass/Partial/Fail | [specific observation] |
| C02 | Direct Answer | Pass/Partial/Fail | [specific observation] |
| ... | ... | ... | ... |
| C10 | Semantic Closure | Pass/Partial/Fail | [specific observation] |

**C Score**: [X]/100
```

Repeat the same table format for **O** (Organization), **R** (Referenceability), and **E** (Exclusivity), scoring all 10 items per dimension.

### Step 3: EEAT Audit (40 items)

```markdown
### Exp — Experience

| ID | Check Item | Score | Notes |
|----|-----------|-------|-------|
| Exp01 | First-Person Narrative | Pass/Partial/Fail | [specific observation] |
| ... | ... | ... | ... |

**Exp Score**: [X]/100
```

Repeat the same table format for **Ept** (Expertise), **A** (Authority), and **T** (Trust), scoring all 10 items per dimension.

See [references/item-reference.md](https://github.com/aaron-he-zhu/seo-geo-claude-skills/blob/main/cross-cutting/content-quality-auditor/references/item-reference.md) for the complete 80-item ID lookup table and site-level item handling notes.

<!-- runbook-sync start: source_sha256=6920bed5f82fd3fe0d6538d71e797e35823385fecfeabdfd81257d2c9d7922d3 block_sha256=be2750a3a71e6e1158c336ae276a2f0c74473b0cf02e1a40b7292d31c7517b12 -->
## §1 · Handoff Schema (authoritative)

Every auditor-class handoff MUST follow this shape. Emitted audit artifact files (e.g., `memory/audits/**/*.md`) MUST include `class: auditor-output` in their YAML frontmatter so the PostToolUse Artifact Gate and guarded auditor archive checks can detect them by frontmatter class instead of prose pattern-matching. Files lacking this marker are not treated as audit artifacts regardless of body content.

```yaml
---
class: auditor-output            # REQUIRED frontmatter marker for emitted audit artifacts
---

status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_INPUT
objective: "what was audited"
key_findings:
  - title: short issue name
    severity: veto | high | medium | low
    evidence: direct quote or data point
evidence_summary: URLs / data points reviewed
open_loops: blockers or missing inputs
recommended_next_skill: primary next move

# Cap-related fields — AUDITOR-CLASS ONLY
cap_applied: true | false        # REQUIRED for auditors
raw_overall_score: <number>      # REQUIRED for auditors; score before cap
final_overall_score: <number>    # REQUIRED for auditors; score after cap
```

### Legacy compatibility for archived outputs

New auditor-class outputs MUST include the cap-related fields. The Artifact Gate treats missing `cap_applied`, `raw_overall_score`, or `final_overall_score` (unless `status: BLOCKED`) as a validation failure.

Consumers reading pre-v7.2 archived outputs may apply these defaults:

- `cap_applied: false` (assume no cap when field missing)
- `raw_overall_score: <use final_overall_score>` (treat as equal)
- `final_overall_score: <use the overall score from the audit, whatever field name>`

This compatibility rule is read-time only; it does not permit new auditor artifacts to omit required auditor-extension fields.

### Non-auditor skills

Non-auditor skill handoffs follow [skill-contract.md §Handoff Summary Format](https://github.com/aaron-he-zhu/seo-geo-claude-skills/blob/main/references/skill-contract.md) as-is. Cap-related fields do not apply. Non-auditors never emit `cap_applied` / `raw_overall_score` / `final_overall_score`, and MUST NOT use the `class: auditor-output` frontmatter marker.

---

## §2 · Critical Fail Cap — Decision Table and Worked Examples

> **How to use this section in Step 4.5**: re-read Worked Example 1 below **before** computing your own cap. Mirror its "Before cap / Veto check / After cap / Handoff" format literally. Walk the decision table (4 rows) to identify which scenario matches your input. Count veto failures across all dimensions (not per-dimension). Apply the cap rule — it is a ceiling, not a floor.

**Rule summary**: when any veto item fails, cap the affected dimension and the overall score at **60/100**. Show raw and capped side by side in the internal report. Set `cap_applied: true` in handoff.

**Veto items**:
- CORE-EEAT: T04, C01, R10 — see [core-eeat-benchmark.md §Veto Items](https://github.com/aaron-he-zhu/seo-geo-claude-skills/blob/main/references/core-eeat-benchmark.md)
- CITE: T03, T05, T09 — see [cite-domain-rating.md §Veto Items](https://github.com/aaron-he-zhu/seo-geo-claude-skills/blob/main/references/cite-domain-rating.md)

### Decision table

| Scenario | Affected dimension behavior | Overall score behavior | Handoff status |
|---|---|---|---|
| **0 veto fails** | no cap | no cap | `cap_applied: false` |
| **1 veto fails; raw dim > 60** | `min(raw_dim, 60)` → capped down to 60 | `min(raw_overall, 60)` | `cap_applied: true` |
| **1 veto fails; raw dim ≤ 60** | unchanged (no raise, no lower) | `min(raw_overall, 60)` | `cap_applied: true` |
| **2+ veto fails** | `status: BLOCKED`, do NOT emit capped scores | `raw_overall_score` retained for record | `cap_applied: false`, reason in `open_loops` |

**Cap target**: always the post-penalty final dimension value, never the raw pre-penalty value. If non-veto items already penalized the dimension, compute the post-penalty number first, then apply the veto cap to that.

**Rounding rule (deterministic)**: all score arithmetic uses `math.floor` (truncate decimals). `77.5 → 77`, not `78`. `59.9 → 59`, not `60`. Applies to `raw_overall_score`, `final_overall_score`, dimension scores, and all intermediate calculations. QA and regression tests can rely on this — a re-run on the same inputs always produces the same integer. Worked Example 2 demonstrates: `raw_overall = 77.5` appears as `raw_overall_score: 77` in the handoff.

### Worked example 1 — single veto, raw dim above cap (classic case)

```
Before cap:
  Dimensions: C=75 O=77 R=80 E=75 Exp=78 Ept=77 A=77 T=85
  Sum = 624; raw_overall = 624 / 8 = 78 (exact)

Veto check: T04 failed (affiliate links without disclosure)

After cap:
  T dimension: 85 → 60 (capped down because raw > 60)
  Overall: 78 → 60 (capped at 60 because any veto forces overall cap)

Handoff:
  cap_applied: true
  raw_overall_score: 78
  final_overall_score: 60
  key_findings:
    - title: "Missing affiliate disclosure"
      severity: veto
      evidence: "No disclosure banner; 3 affiliate links detected in body"
```

### Worked example 2 — single veto, raw dim already below cap

```
Before cap:
  Dimensions: C=55 O=75 R=88 E=80 Exp=80 Ept=75 A=82 T=85
  raw_overall = 77.5

Veto check: C01 failed (clickbait — title doesn't match content)

After cap:
  C dimension: 55 → 55 (unchanged; cap is a ceiling, not a floor)
  Overall: 77 → 60 (overall still capped because veto present)

Handoff:
  cap_applied: true
  raw_overall_score: 77
  final_overall_score: 60
  key_findings:
    - title: "Title promises something the page doesn't deliver"
      severity: veto
      evidence: "Title: '10 Free Tools'; body delivers 3 free tools and 7 paid"
```

**Important**: the C dimension number in the internal report stays 55. It is NOT raised to 60. The cap is a ceiling only.

### Worked example 3 — 2+ veto fails (BLOCKED path)

```
Before cap:
  Dimensions: C=75 O=77 R=80 E=75 Exp=78 Ept=77 A=77 T=85
  Sum = 624; raw_overall = 624 / 8 = 78 (exact)

Veto check: T04 AND R10 both failed

Resolution:
  status: BLOCKED
  Do NOT compute capped scores.
  raw_overall_score retained for record; final_overall_score omitted.

Handoff:
  status: BLOCKED
  cap_applied: false
  raw_overall_score: 78
  # final_overall_score intentionally omitted
  open_loops:
    - "2 veto items failed: T04 (affiliate disclosure) and R10 (data inconsistency)"
    - "Multi-veto cap calibration pending v7.3; page requires manual review before re-scoring"
  key_findings:
    - title: "Missing affiliate disclosure"
      severity: veto
      evidence: "..."
    - title: "Data points contradict each other"
      severity: veto
      evidence: "..."
```

**Why BLOCKED, not "capped at 40"**: the 40-tier cap number is unvalidated. Blocking forces manual review, which is more honest than publishing an eyeballed number. Calibration trigger: 30+ real multi-veto audits in `memory/audits/`, reviewed through `/aaron:guard --evals` plus maintainer calibration.

**Note on dimension vs count**: the 2+ veto threshold counts **total veto failures across all dimensions**, not per-dimension. Example 3 shows T04 (Trust dim) + R10 (Referenceability dim) on different dimensions, but T03 + T09 both on the Trust dimension would also trigger BLOCKED. The veto count is dimension-agnostic.

---

## §3 · Guardrail Negatives (wind
