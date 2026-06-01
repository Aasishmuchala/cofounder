---
name: beta-program-management
description: Running closed and open betas that produce real signal. Beta participant selection, structured feedback collection, beta-to-GA decision criteria, and the difference between soft-launch (no structure, no signal), kitchen-sink (everyone in, n
source: github:rampstackco/claude-skills
---

# Beta Program Management

A senior product leader's playbook for running betas that produce real signal. Closed and open betas, alpha programs, design partner programs, early access. Participant selection, structured feedback collection, beta-to-GA decision criteria, and the difference between soft-launch (no structure, no signal), kitchen-sink (everyone in, no actionable feedback), and structured beta (calibrated cohort, intentional feedback loops, clear graduation criteria).

Most betas underperform. Teams ship a beta because they think they should run a beta; participants are recruited loosely or open-flooded; feedback is collected ad-hoc through whatever channels exist; the decision to graduate to GA happens on calendar rather than on signal. The beta produced activity but not learning; the team launches with the same uncertainty they had before the beta.

This skill is the discipline that turns betas into decision input. Calibrated cohorts who match the post-launch user profile. Structured feedback that captures what the team needs to know. Mid-beta triage that uses what is being learned. Graduation criteria that distinguish "ready" from "we are tired of running the beta." The discipline is not bureaucratic; it is the difference between a beta that informs the GA launch and a beta that produces noise.

The voice is the senior product leader who has run betas with real signal and watched plenty of betas produce nothing. Concrete, opinionated about what produces signal, willing to call out where beta programs slide into ceremony.

When to use this skill: planning a beta for an upcoming launch, auditing why prior betas have not produced actionable signal, designing the beta participant experience, or deciding whether a feature is ready to graduate from beta to GA.

---

## What this skill is for

This skill spans beta program design and execution. The PM and engineering distinction:

- `feature-flagging` is rollout mechanics; the technical layer for controlling who gets which features.
- **`beta-program-management` (this skill)** is participant management and feedback discipline; the human layer.
- `feature-launch-playbook` is the full launch (post-GA); this skill is what happens BEFORE GA.
- `experiment-design` is rigorous A/B testing; betas are softer, qualitative-leaning, smaller-N.
- `user-feedback-aggregation` is ongoing feedback streams; beta feedback is bounded to the beta period.
- `discovery-research-synthesis` is one-off discovery research; betas are validation-stage rather than discovery-stage.

The audience: senior PMs, product directors, engineering leads coordinating with product, customer success and support running beta cohorts, anyone planning a closed or open beta.

What is not in scope: the broader feature launch (covered by `feature-launch-playbook`); the technical rollout mechanics (covered by `feature-flagging`); the rigorous experimentation methodology (covered by `experiment-design`); the discovery-stage research that informs whether to build the feature in the first place.

---

## Soft-launch vs kitchen-sink vs structured-beta

The keystone framing.

**Soft-launch.** "We will just turn it on for some users." No structured participant selection, no defined feedback collection, no graduation criteria. The beta runs because the team wanted to ship the feature without the full launch ceremony. Output: the feature is in production for some users; the team has no organized way to learn from their experience; signal accumulates through whatever channels happen to surface it; mid-beta course-correction does not happen because there is no structure to surface what should be corrected.

**Kitchen-sink.** Everyone gets in. The beta opens to whoever signs up. 5,000 beta users; 50 useful pieces of feedback; 4,950 silent users who provide no signal. Volume drowns signal. The team cannot tell which users matched the target post-launch profile. Feedback channels overflow; useful patterns get lost in noise; mid-beta triage cannot keep up. Output: a sense of "we ran a big beta" without the actionable feedback that smaller calibrated cohorts produce.

**Structured-beta.** Calibrated cohort selected by participant criteria. Intentional feedback loops the cohort knows to use. Clear graduation criteria that distinguish "ready for GA" from "tired of the beta." Mid-beta triage that uses what is being learned. Output: the beta produces decision-grade signal; the GA launch ships with confidence; problems that would have surfaced in production get caught and addressed in beta.

The litmus test. After the beta concludes, ask: what specifically did we learn from this beta that changed the GA launch? If the team can name 3-7 specific lessons, the beta was structured. If the team can only generally say "the beta went well," the beta was soft-launch or kitchen-sink.

---

## Beta type decisions

Several axes of beta-type choice. The right combination depends on the launch context.

**Closed vs open.**

- Closed: invite-only. Participants are selected by criteria. Cohort is bounded.
- Open: anyone can join. Cohort is self-selecting.
- Closed produces calibrated signal; open produces volume signal that may not match the target user profile.

**Alpha vs beta vs RC.**

- Alpha: very early, internal or trusted-partner only, expectation of bugs.
- Beta: more polished, broader cohort, expectation of feedback rather than crash discovery.
- RC (release candidate): essentially launch-ready, last validation, expectation of production-grade quality.

**Internal vs external.**

- Internal: only employees use the feature.
- External: real customers use the feature.
- Internal betas catch only what employees would experience; external betas catch the full user-context complexity.

**Time-bounded vs open-ended.**

- Time-bounded: 4-week beta, 8-week beta, with a defined end.
- Open-ended: beta runs until the team decides to graduate.
- Time-bounded forces the graduation decision; open-ended risks beta-purgatory.

The combination decision. A typical structured beta might be closed + beta + external + 6-week time-bounded. A design partner program might be closed + alpha + external + open-ended. An open early access might be open + beta + external + time-bounded. The combination should match the kind of signal the team needs.

Detail in [`references/beta-type-decisions.md`](references/beta-type-decisions.md).

---

## Participant selection criteria

The discipline that makes calibrated cohorts possible.

**The criteria that work.**

- **Match the post-launch user profile.** If the feature is for enterprise admins, beta participants should be enterprise admins, not curious individual users. The beta participant profile should resemble the target GA audience.
- **Variety across relevant dimensions.** Not all participants identical. If the feature has segment-specific behavior, the cohort spans segments. If usage volume varies, the cohort includes high-volume and low-volume users.
- **Feedback willingness.** Participants who agree to provide feedback through the structured channels. Soft commitment ("I will give feedback when I have time") is weaker than explicit commitment ("I will respond to weekly check-ins and complete the structured survey").
- **Existing relationship strength.** Customers with strong existing relationships are more likely to engage substantively. Customers in churn-risk are less likely to engage; their feedback may also be less representative.

**The criteria that fail.**

- **Self-selection only.** Open beta sign-ups skew toward enthusiasts and tinkerers; their feedback may not represent the broader target user.
- **Highest-paying customers only.** Skews toward enterprise patterns that may not generalize; misses smaller-team use cases.
- **Internal employees only.** Misses the customer-context complexity; signals "we tested" without "real users tested."

**The cohort size question.** Calibrated cohorts are usually 20-200 participants for closed external betas. Smaller (5-20) for design partner programs. Larger (200-2,000) for open early access. Beyond 2,000 the program is a soft-launch with beta branding.

Detail in [`references/participant-selection-criteria.md`](references/participant-selection-criteria.md).

---

## Beta cohort sizing

How big is enough; when does signal saturate.

**Saturation patterns.**

- Critical feedback (bugs, crashes, broken flows) saturates quickly. 20-30 participants surface most critical issues in the first 2 weeks.
- Behavioral feedback (how users actually use the feature) saturates more slowly. 50-100 participants needed to see usage patterns clearly.
- Edge case feedback saturates slowly. 100+ participants needed; some edge cases never surface in beta.

**Sizing decisions.**

- For betas focused on bug discovery: 20-50 participants for 2-4 weeks. Beyond this, returns diminish.
- For betas focused on behavioral signal: 50-200 participants for 4-8 weeks.
- For betas focused on validating product-market fit assumptions: 100-500 participants over 8-12 weeks.
- For betas focused on at-scale infrastructure validation: 500-2,000 participants over 4-8 weeks.

**The "beta size matches signal need" principle.** Cohort size follows from what the team needs to learn. Larger is not always better; calibrated is.

Detail in [`references/cohort-sizing-patterns.md`](references/cohort-sizing-patterns.md).

---

## Onboarding beta participants

How participants enter the beta and what they know going in.

**The setup.**

- Welcome communication that sets expectations: what the beta is, what feedback is expected, how long it runs, what happens at graduation.
- NDAs where relevant (for unannounced features, design partner programs).
- Feedback channel access: where participants give feedback, what format, what cadence.
- Support escalation path: who participants contact when things break.
- Compensation or incentive disclosure: free access to the feature post-GA, gift cards, swag, named recognition, etc.

**The expectations contract.**

- What the team commits to participants: communication cadence, response to feedback, transparent about graduation criteria.
- What participants commit to the team: feedback through the structured channels, not sharing externally during NDA, willingness to engage in interviews if requested.

**Common onboarding failures.**

- Vague expectations. Participants do not know what feedback is wanted; ad-hoc venting fills the channels.
- No NDA where appropriate. Beta features get screenshotted on social before the team is ready.
- Missing support path. Participants hit issues, do not know who to contact, churn out of the beta.
- No incentive clarity. Participants feel underrecognized; engagement decays.

Detail in [`references/beta-onboarding-templates.md`](references/beta-onboarding-templates.md).

---

## Feedback collection patterns

Structured channels that produce signal rather than noise.

**Channels that work.**

- **Structured surveys.** 5-15 question surveys at defined points (week 1, week 4, end of beta). Specific questions tied to the team's learning goals.
- **Async feedback forms.** Participants submit specific feedback through a defined form. Fields prompt for use case, severity, expected vs actual behavior.
- **Structured interviews.** 30-60 minute interviews with a subset of participants (5-15 per beta). Focused on usage patterns, decision moments, and qualitative depth.
- **In-product feedback widgets.** Contextualized to the moment. The feedback is timestamped to the user's actual experience.
- **Support tickets routed to beta-aware support.** Beta participants get faster, more contextualized support; the support interactions surface usage friction.

**Channels that fail.**

- **Slack channels for venting.** Beta participants vent in real time; signal mixes with noise; nobody synthesizes.
- **"Reply to this email with feedback."** Returns long unstructured emails; synthesis is hard; useful patterns get lost.
- **"Tell us what you think in the survey at the end."** End-of-beta surveys catch only what participants remember; in-the-moment friction is forgotten.

**Channel mix discipline.** Most structured betas use 3-5 channels. Each channel surfaces different kinds of signal. The team synthesizes across channels.

Detail in [`references/feedback-collection-patterns.md`](references/feedback-collection-patterns.md).

---

## Mid-beta triage and iteration

How the team responds to feedback during the beta.

**The principle.** Betas where the team responds to feedback during the beta produce stronger signal than betas where the team waits for the end.

**The triage cadence.**

- Weekly: review feedback across all channels. Categorize: critical bug, friction issue, feature request, positive signal, edge case.
- Bi-weekly: surface patterns. What recurring feedback are we seeing? What signal is converging?
- As-needed: critical issues get same-day response. Bugs that prevent core flows are not allowed to sit.

**The iteration discipline.**

- Critical bugs fixed during the beta. Beta participants experience the fixes; the post-fix experience informs the GA decision.
- Friction issues prioritized for fixes during the beta where feasible; documented for the GA decision where not.
- Feature requests captured for post-GA roadmap; not added during the beta unless they are graduation-blocking.
- Positive signal validated; surfaces what works, informs marketing copy and onboarding for GA.

**The communication discipline.** Participants are kept informed: "We received your feedback on X; we are addressing it in next week's beta update." Silence makes participants feel ignored; over-communication signals overhead. Calibrate.

Detail in [`references/mid-beta-triage-and-iteration.md`](references/mid-beta-triage-and-iteration.md).

---

## Beta-to-GA decision criteria

Graduation gates that distinguish "ready" from "tired of running the beta."

**The criteria.**

- **Critical bugs cleared.** No known crashes, data loss, or core-flow failures.
- **Friction issues addressed or accepted.** Friction the team will not address by GA is documented and accepted as known limitation.
- **Behavioral validation.** Beta participants are using the feature in the patterns the team expected. Unexpected patterns are understood (either incorporated into the GA experience or addressed).
- **Performance under load.** The feature performs adequately at the scale GA will produce. (For infrastructure betas, this is the central criterion.)
- **Documentation and support readiness.** Help docs reflect actual usage; support team is trained on common issues; escalation paths work.
- **Positive signal sufficient.** Feedback is net-positive enough to launch with confidence. Not all participants delighted, but a substantial majority finding value.

**The "we are tired of running the beta" anti-pattern.** Beta has run long enough that the team wants to graduate regardless of signal. The graduation decision happens on calendar rather than on criteria. Resist this; either the criteria are met (graduate) or they are not (extend or reset).

**The "perpetual beta" anti-pattern.** Beta runs indefinitely because no firm graduation criteria were set. The team avoids the GA commitment by keeping the feature in beta. Force the graduation decision; if the feature is not ready for GA, identify what would make it ready or reconsider whether to ship at all.

Detail in [`references/beta-to-ga-graduation-criteria.md`](references/beta-to-ga-graduation-criteria.md).

---

## Beta wind-down and participant communication

How the beta ends.

**The graduation announcement.** Participants are told the feature is graduating. Specific date. What changes for them: continued access (typically yes), pricing changes (often beta participants get free access for some period), feature stability commitments (the GA version is what they will use going forward).

**The transition.**

- For most participants: nothing chan
