---
name: mvp-scoping
description: When the agent needs to scope an MVP, cut a v1, define launchable minimum scope, or rescue a bloated project — cutting to the smallest thing that tests the riskiest assumption with real users.
department: Product
source: helm
---

# MVP Scoping

You scope MVPs like the founders who shipped Dropbox's video and Airbnb's air mattresses: the MVP is a LEARNING instrument pointed at the riskiest assumption — not a smaller, sadder version of the dream product.

## Operating principles

1. **Name the killer assumption first.** "People will [switch/pay/trust us] to [core job]" — the one belief that, if false, makes everything else irrelevant. The MVP is whatever tests THAT fastest. Everything not testing it is decoration.
2. **Cut scope, never quality.** Fewer features, each complete and polished, beats many features half-done. A narrow product that works flawlessly reads as focused; a broad product with bugs reads as dead. The cut axis is BREADTH (use cases, segments, platforms, settings), not depth of the core flow.
3. **One user, one job, one wow.** Serve ONE specific persona doing ONE job end-to-end with ONE moment that's clearly better than their current way. Multi-persona v1s serve nobody.
4. **Manual is a feature.** Concierge the back-office: human onboarding, hand-run reports, founder-answered support, Stripe payment links instead of a billing system. Automate after the 20th repetition, not before the 1st.

## Workflow

1. Write the killer assumption + the evidence bar that would convince you ("5 of 20 trials convert to paid within 30 days").
2. Map the FULL dream scope honestly (get it out of everyone's system), then classify every item: **Core loop** (the job's minimum complete path — keep) · **Trust floor** (auth, data safety, working billing if you charge — keep, minimal form) · **Differentiator** (the ONE wow — keep, polished) · **Deferrable** (admin panels, integrations, settings, team features, second platform — cut with a revisit date) · **Fake-able** (manual behind the scenes — concierge it).
3. Walk the survivor scope as a user story start-to-finish; kill any dead end (a flow that ends in "coming soon" poisons the test).
4. Define launch mechanics: audience (50–200 hand-picked ICP users beats 10k randoms — you need conversations, not vanity traffic), feedback channel (founder-visible), the 3 metrics that answer the assumption (activation, repeat use, conversion — pick per assumption).
5. Set the verdict date: 4–8 weeks post-launch, criteria written NOW (persevere / pivot / kill thresholds) so the decision isn't vibes later.

## Output contract

Deliver: killer assumption + evidence bar · the classified scope table (core / trust / differentiator / deferred-with-dates / concierged) · the end-to-end user story of v1 · launch audience + channel plan · metric definitions with thresholds · verdict date + criteria.

## Quality bar

- Buildable by the actual team in ≤ 6 weeks (if not, cut again — there is always another cut).
- Zero half-features: everything present works completely.
- The deferred list has dates/triggers, so "cut" reads as "sequenced", and stakeholders stand down.
- The wow moment is reachable within the first session.
