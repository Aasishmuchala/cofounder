---
name: ads-performance-analytics
description: How to read paid media dashboards without fooling yourself. Attribution models, platform reporting quirks, multi-platform reconciliation, ROAS vs LTV horizon traps, statistical noise in performance metrics, incrementality testing, and the f
source: github:rampstackco/claude-skills
---

# Ads Performance Analytics

A data-team-mentor's playbook for interpreting paid media dashboards without fooling yourself.

The dashboard is the moment of truth for paid media decisions. The numbers on it determine whether you scale, hold, or kill. They also expose every platform's self-attribution bias, every modeled-conversion shortcut, every cross-platform double-count. Most "scale this campaign" decisions trace back to misreading the dashboard.

This skill is the discipline that prevents misreading. It assumes the campaign was strategically sound (see `paid-media-strategy`). It assumes the creative was tested properly (see `ads-creative-development`). The hard part is knowing what each number actually means, what it does not, and how to reconcile platform-reported metrics with the truth in your warehouse.

When to use this skill: any time you are about to scale, kill, or rebudget a campaign based on platform metrics; reconciling platform reports with revenue data; evaluating an agency's reporting; or building a paid media dashboard that will not lie to you.

---

## What this skill is for

This skill spans paid media result interpretation. It does not cover paid media strategy (use `paid-media-strategy`), creative production (use `ads-creative-development`), or platform-specific tooling (covered in the integrations microsites). Pair this skill with the relevant integrations microsite for platform-specific MCP commands and example prompts.

The audience is a marketer, growth analyst, agency analyst, or founder evaluating paid media reports. The voice is patient and clinical. There is no "trust the platform's number" or "ignore the platform entirely." Both are wrong. The discipline is knowing which numbers from which platform mean what, and what to reconcile against to make the actual decision.

---

## The result panel: what every paid media platform should expose

A trustworthy result panel exposes nine things. Anything missing is a signal to treat reported numbers with extra skepticism.

1. **Spend, impressions, clicks.** Table-stakes metrics. Should match across platforms within rounding.
2. **Conversions with definition and window visible.** Not just a count; the definition of what counts as a conversion and the attribution window applied. Without this, the count is unreadable.
3. **Attribution breakdown.** Last-click vs view-through vs modeled. The mix of how the conversions were credited.
4. **Frequency.** Impressions per unique user. The fatigue early-warning system.
5. **Audience saturation.** Where the platform exposes it. A flat audience-saturation curve means there is room to scale; a steep curve means efficiency is dropping.
6. **Time series.** Daily breakdown to spot novelty effects, fatigue, day-of-week patterns, and exogenous variance.
7. **Cost metrics in clear currency.** CPC, CPM, CPA, ROAS with the math defined and the currency labeled. Do not assume USD.
8. **Conversion path data.** Touchpoints before conversion, where available. Tells you whether a campaign is a closer or an opener.
9. **Filters, segments, and exports.** Without these, the panel is a brochure, not a tool.

Platforms hide what makes their reporting look weakest. Google PMax hides keyword-level and placement-level data. Meta hides the modeled-conversion share. LinkedIn hides cross-device click paths. Treat hidden metrics as the place to dig.

---

## Platform-reported vs reality

Every platform's dashboard is optimized to make the platform look effective. This is not a moral failing; it is a structural incentive. Platforms with rosier reporting attract more spend.

**Conversion windows.** Meta defaults to 7-day click plus 1-day view. Google defaults to 30-day click plus 1-day view. Different windows, same activity, different reported numbers. If you compare Google's 30-day-click count against Meta's 7-day-click count, you are comparing different definitions and pretending they are the same.

**View-through attribution.** Counted by Meta and Google for users who saw but did not click. Often half the reported "conversions" are view-through. Treat view-through as a signal of awareness contribution, not as a direct response measurement. The user might have converted from organic search anyway.

**Modeled conversions.** When iOS users opt out of tracking, Meta and others statistically model what the conversion would have been. Modeled numbers are educated guesses, not measurements. They are useful for direction; they are not reliable for precision.

**Self-attribution bias.** Every platform's pixel fires on conversion and the platform claims credit. If you ran Meta, Google, and TikTok in the same week, all three platforms report your conversions as theirs. Sum-of-platforms is always greater than 100% of actual conversions.

The discipline. Never report platform-reported numbers as fact in board decks. Always reconcile against the single source of truth (warehouse, GA4, or unified analytics platform). Detail in [`references/platform-reporting-quirks.md`](references/platform-reporting-quirks.md).

---

## Attribution models in practice

Six models and one anti-model. None is right. They are all approximations. The discipline is picking one, committing, and reading the others as sanity checks.

**Last-click.** Simple, reproducible, undercredits awareness. The conversion is fully credited to the last click before the conversion event. Easy to compute; easy to compare across channels; bad for understanding upper-funnel contribution.

**First-click.** Opposite bias. Fully credits the first touchpoint, undercredits closing channels. Useful as a sanity check against last-click; rarely the right primary view.

**Linear.** Equal credit across all touchpoints. Gives every channel something. Defensible; not informative. Most useful for board reporting where avoiding "Google gets 70% so we cut Meta" politics matters more than precision.

**Time-decay.** More credit to recent touchpoints. Reflects the intuition that recent ads are more influential. Hard to argue against; hard to verify.

**U-shaped (position-based).** Heavy on first and last (40% each), light on middle (20% distributed). Honors both opener and closer roles. The default in many MTA tools.

**Data-driven attribution (DDA, Google).** Machine-learning model that distributes credit based on observed conversion paths. Opaque; hard to audit. The closest to "right" for digital channels but a black box.

**Marketing mix modeling (MMM).** Regression-based, top-down. Uses spend and revenue time series across channels to estimate channel contributions. Requires 2+ years of data. The strongest defense against platform self-attribution because it does not rely on platform-reported conversions at all.

**The anti-model: trusting platform-reported attribution.** Each platform's "DDA" or "attributed conversions" is the platform's self-attribution. Sum across platforms exceeds reality. Use platform attribution for in-flight optimization within the platform; use a unified attribution model for cross-channel decisions.

Practical guidance.

- Early-stage. Use last-click plus a single guardrail metric (warehouse-attributed CAC). Sophisticated attribution requires data volume you do not have.
- Mid-stage. Data-driven attribution from Google plus GA4, with explicit awareness vs closing channel labeling.
- Mature. MMM as the canonical incremental reference. MTA for in-flight optimization. Last-click for channel-level decisions where ambiguity is acceptable.

Detail and a decision matrix in [`references/attribution-model-comparison.md`](references/attribution-model-comparison.md).

---

## Multi-platform reconciliation

The trap. Google says you spent $50K with 800 conversions. Meta says $30K with 600. LinkedIn says $20K with 200. Total reported equals 1,600 conversions. Your warehouse says 950. Where did 650 go?

The answer. Nowhere. They never existed. Each platform claimed conversions other platforms also claimed.

The reconciliation pattern.

- Trust the warehouse for total conversions and total revenue.
- Trust platforms for relative ranking within platform (which campaign won, which audience won).
- Never trust platform sums.
- Compute blended CAC as (total ad spend across platforms) divided by (total new customers from warehouse). Not from platform reports.

The board-deck pattern. Report warehouse-attributed conversion counts, never platform-summed. Report blended CAC, not channel-by-channel CAC unless explicitly noted as platform-self-attributed. Detail and templates in [`references/dashboard-reconciliation-patterns.md`](references/dashboard-reconciliation-patterns.md).

---

## ROAS vs LTV: the time horizon trap

ROAS is short-term. Revenue from purchases attributed to a campaign in a fixed window, often 7 to 30 days. LTV is long-term. Total customer lifetime revenue.

Decisions made on ROAS can be wrong if LTV varies by channel. A worked example.

Meta drives 2.5x ROAS at $40 CAC with $80 LTV. The 7-day-click revenue covers 1.5x payback over the customer lifetime.

Google drives 1.8x ROAS at $60 CAC with $200 LTV. The 7-day-click revenue covers 3.3x payback over the customer lifetime.

Google looks worse on ROAS, better on LTV-adjusted return. Allocating budget to Meta because the ROAS is higher is the wrong move.

The fix. Cohort-based LTV by acquisition channel, updated quarterly. Compare channels on payback period or LTV-CAC ratio, not raw ROAS. The 2x ROAS heuristic is a dangerous shortcut. Same ROAS at different LTVs equals different actual returns.

The trap that compounds. Performance teams optimize for short-term ROAS because the metric refreshes weekly. Brand and high-LTV channels get cut because their short-term ROAS is lower. Six months later, the brand pipeline has eroded and short-term ROAS itself drops because the cheap channels are saturated. The metric that drove the decision was the wrong horizon.

---

## Cohort analysis vs daily metrics

Daily metrics tell you what happened today. Cohort analysis tells you whether today's customers are different from last month's.

Three cohort cuts that matter for paid media.

**By acquisition month.** Are users acquired in March retaining better than users acquired in January? A declining LTV over rolling acquisition cohorts means recent acquisition is lower quality; the daily metrics will show this two to three months later when the retention starts hurting.

**By acquisition channel.** Are users from Meta retaining better than users from Google? Channel-level cohort divergence is the data behind the LTV-vs-ROAS argument. Meta might drive volume at lower LTV; Google might drive lower volume at higher LTV. The cohort tells the story the daily ROAS hides.

**By acquisition campaign.** Campaign-level cohort signals. Useful for diagnosing why a campaign that "works" in week 1 produces no recurring revenue.

The signal to act on. Declining cohort LTV over two consecutive months is the alarm. Pause the channel or campaign before the daily metrics force you to. Detail in [`references/cohort-analysis-templates.md`](references/cohort-analysis-templates.md).

---

## Statistical noise in performance metrics

Most "the campaign improved 15% week over week" stories are noise. Real performance changes are 30% or more in metrics that vary 10 to 20% naturally. Below that threshold, you are looking at variance and calling it signal.

Sources of noise in paid media metrics.

- **Day-of-week effects.** B2C tends to weekend dips. B2B tends to weekend gains. A "Monday morning is better" hypothesis often dissolves when day-of-week is normalized.
- **Holiday and seasonal effects.** Q4 dwarfs most "optimization" effects. A campaign launched in Q4 looks great because of seasonality, not strategy.
- **Weather, news, competitor activity.** Real exogenous variance. Last week's news cycle can shift CPMs across an entire vertical.
- **Pixel fire and reporting delay.** Conversions reported on a 7-day click window arrive incrementally. Reading the panel on Monday for last week's performance undercounts.

The fix. Pre-commit to test duration before drawing conclusions. Use the experimentation discipline from `experimentation-analytics` for any directional change you want to claim is real. The signal-to-noise problem in paid media metrics is the same as the signal-to-noise problem in product experiments; the framework transfers.

This is where `experimentation-analytics` bridges in. The statistical patterns are the same; the application is different. Read both for the full picture.

---

## Incrementality testing

The honest test. If we had not run this ad, would we still have gotten the conversion? The number above zero is the incremental contribution.

Most paid media is 30 to 70% incremental, not 100%. Some is zero. Branded search bidding is often 5 to 20% incremental (most converters would have found you organically). Retargeting is often 20 to 40% incremental (many of those users were going to convert anyway). Prospecting is often 50 to 90% incremental.

Four methods.

**Geo holdout.** Hold one region out from the campaign. Measure the difference in conversions between the holdout region and the matched test region. The cleanest causal test for paid media at scale.

**Ghost bidding (Google).** Google's own incrementality tool. Bids on a holdout share of impressions but does not actually serve the ad. Reports incremental conversions. Honest signal; some teams find the math opaque.

**Conversion lift studies (Meta).** Splits audiences into test and control. Test sees the ad; control does not. Reports incremental lift. The cleanest within-Meta test.

**PSA tests.** Serve some users a public service announcement instead of your ad. Compare conversion rates. Useful for legacy brands with deep budget.

Incremental rate ranges by channel type are in [`references/incrementality-testing-playbook.md`](references/incrementality-testing-playbook.md). The discipline is to run incrementality tests at least quarterly on the highest-spend channels. Without them, you are optimizing against platform-reported attribution that systematically overcounts.

---

## Geo experiments and holdouts

For paid media specifically, geo-based testing is the most reliable causal method.

**Geo holdout.** Turn off paid media in one region. Measure baseline organic conversions. The difference between expected and actual conversions in the holdout region is the incremental paid contribution.

**Geo lift.** Scale spend in one region by 2x. See if conversions scale linearly. A linear scale means the channel has headroom. A sublinear scale means saturation; further spend is diminishing returns.

**Switchback.** Alternate weeks of campaign on and off. Compare on-weeks to off-weeks. Useful when geo splitting is not feasible.

**Pre-and-post analysis.** Launch in a region; measure 30 days before vs 30 days after. Weak design because external factors confound the comparison. Use only when no other test is available.

The right setup. Matched markets (similar demographics, similar baseline conversion rates). Statistical power calculation upfront (how big a difference can the test actually detect). Pre-committed analysis window (so you do not stop early when the data looks good or wait too long when it looks bad).

The trap. Calling a geo test successful because of timing-correlated revenue lift. A campaign launched in October will see "lift" because Q4 is starting; without a control region, the lift is not attributable to the campaign.

---

## Platform self-attribution bias

A specific failure mode worth its own section.

The mechanism. Platform's pixel fires on conversion. Platform claims credit. The user might have converted from any channel; the platform that loaded the pixel last gets the credit on the platform's own dashboard.

Why platforms reward this design. More credit on the platform dashboard equals better-looking ROAS equals more advertiser spend. Platforms have no incent
