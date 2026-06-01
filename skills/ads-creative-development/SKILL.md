---
name: ads-creative-development
description: How to produce ad creative that converts at performance scale. Hook patterns, format selection, video pacing, variation systems, sequential testing methodology, fatigue detection, brand-voice alignment without conversion dilution, and platf
source: github:rampstackco/claude-skills
---

# Ads Creative Development

A senior creative strategist's playbook for producing ad creative that performs.

Performance creative is a different discipline from brand creative. Brand work optimizes for memorability, emotional resonance, and distinctive identity. Performance creative optimizes for stopping the scroll, communicating value in three seconds, and producing a click. Both matter. Mixing them up costs money. Brand creative running as performance ads bleeds budget; performance creative running as brand ads erodes equity.

This skill is the discipline that produces performance creative without diluting brand. It assumes you know your audience and offer (see `paid-media-strategy`). It assumes you have brand-voice guidance (see `brand-voice`). The hard part is the systematic production of variations that test cleanly and ship without manual approval bottlenecks, and that is what is here.

When to use this skill: producing ad creative for paid campaigns, planning a creative testing cycle, diagnosing creative fatigue, or auditing why creative is not converting.

---

## What this skill is for

This skill spans creative production, hook patterns, testing methodology, and fatigue diagnosis. It does not cover paid media strategy (use `paid-media-strategy`), result interpretation (use `ads-performance-analytics` once it ships), or brand voice authoring (use `brand-voice`). Pair this skill with the relevant integrations microsite for platform-specific MCP details and example prompts.

The audience is an ad creative producer, a growth marketer responsible for creative testing, or an agency producing creative at scale. The voice is tactical. There is no "consider every option." Performance creative has shape, and a senior practitioner can map a brief to a production-ready variation matrix in an afternoon.

---

## Performance vs brand creative

The two disciplines optimize for different metrics. Brand creative optimizes for memorability, distinctiveness, and emotional resonance over months. Performance creative optimizes for scroll-stop in 1 second, value comprehension by 5 seconds, and click by 15.

The shared layer. Both should reflect brand voice. Both should look like they came from the same brand. The difference is structure, pacing, and where the creative effort concentrates.

The failure mode. Most agency creative tries to do both and does neither well. The brand video that runs as a 60-second performance ad has a strong narrative arc and zero CTR. The performance ad that ignores brand voice converts but trains the audience to not recognize the brand. The fix is not to compromise; it is to produce both, in their respective formats, with shared voice and divergent structure.

A worked example. A premium coffee brand running a 60-second YouTube awareness ad gets to build the world: cinematography, the founder's hands, slow-pour rituals, music that sets a mood. That same brand running a 15-second Meta Reels performance ad gets 1 second to stop the scroll (a visual pattern interrupt: the steam rising from a cup, fast cut, brand logo dropping in), 4 seconds to clarify the offer (the new flavor, the price, the deal), 8 seconds for social proof (three customer-style testimonials, fast cuts), and 2 seconds for CTA (shop now, end card with logo). Same voice. Different structure. Different pacing. Different creative effort distribution.

---

## Hook patterns: the first 3 seconds

The biggest lever in performance creative. If the hook fails, no amount of body copy or CTA can recover the impression. A user who scrolled past the first second has already decided. The hook is the whole game until the body justifies why the user kept watching.

Twelve hook patterns work consistently. Detail in [`references/hook-pattern-library.md`](references/hook-pattern-library.md).

1. **Problem-agitate-solve.** Open with the problem the audience feels. Agitate by naming the consequence. Solve with the offer. Works when the audience recognizes the pain.
2. **Direct callout to audience.** "If you are a B2B founder running paid ads..." Triggers self-identification. Works when the audience is narrow and self-aware.
3. **Contrarian claim.** "Stop using lookalike audiences." Hooks attention by violating expectation. Works when the audience has heard the conventional wisdom too often.
4. **Result-led.** "How we cut CAC 40% in 30 days." Specific number, specific timeframe. Works when the result is real and documented.
5. **Curiosity gap.** "The mistake 80% of marketers make..." Promises a payoff after the gap. Works when the gap is real; clickbait without payoff trains the audience to scroll past.
6. **Social proof at top.** "Used by 10,000+ teams." Validation before pitch. Works when the proof is impressive enough to do the heavy lifting.
7. **Visual pattern interrupt.** A surprising visual that does not match the platform's usual feed flow. Works on TikTok and Reels where the pattern is fast and the interrupt is louder.
8. **Question that hits intent.** "Tired of paying $400 for project management software?" The question pre-qualifies the audience. Works when the question matches a real search query the audience has typed.
9. **Number-led.** "3 changes that doubled our ROAS." Lists trigger the brain's pattern-completion instinct. Works for educational content; less so for product ads.
10. **Personal story open.** "Last year I was burning $50K a month on Meta ads with no return..." First-person specificity is hard to skip. Works when the story is real and the conclusion is action-relevant.
11. **Comparison.** "X vs Y: which actually works." Pits two options against each other. Works when the audience is in evaluation mode.
12. **Behind-the-scenes / process.** "How we onboard a new client in 7 days..." Demystifies the work. Works when the process is the differentiator.

For each pattern, the anti-pattern is the same: a hook that does not actually hook. Generic openings ("In today's world...", brand-logo cards, slow zooms over title cards) train the audience to scroll past. The first second is for the hook. The brand can wait.

---

## Format selection

Different formats fit different combinations of audience, platform, and offer.

- **Static image.** Best for simple value props, retargeting, and quick test cycles. Lowest production cost. Limited room for narrative.
- **Carousel.** Best for multi-feature products, educational content, and B2B SaaS. Each card carries one idea; users swipe through at their own pace. Strong for considered purchases.
- **Video (in-feed).** Best for demonstration, story, and broad audiences. Higher production cost. Performance correlates strongly with hook quality.
- **UGC-style video.** Best for trust building, social proof, and lower production cost. Looks like an ordinary user filmed it. Especially strong on TikTok and Reels.
- **Stories or Reels (vertical 9:16).** Best for TikTok, Instagram, and Snap. Native to the platform's primary surface. Skipping anything not vertical here is leaving performance on the table.
- **Spark Ads (boosted organic).** Best for TikTok. Promotes an existing organic post as an ad. Retains organic engagement signals; consistently outperforms pure paid creative on TikTok.

The decision rule. Match format to platform native style and to audience consumption pattern. Detail in [`references/format-decision-matrix.md`](references/format-decision-matrix.md).

---

## Video pacing

Video performance correlates more with pacing than with production value. A well-paced phone-shot video outperforms a poorly-paced agency-produced spot. Specific guidance for the 15-second performance video.

| Time window | Job |
|---|---|
| 0 to 1s | Hook. Visual pattern interrupt plus audio hook. |
| 1 to 3s | Clarify what this is. Brand and offer registered. |
| 3 to 7s | Value proposition. The problem-solution moment. |
| 7 to 12s | Social proof or demonstration. Show, do not just tell. |
| 12 to 15s | CTA. End card with logo and call to action. |

Anything past 15 seconds in a performance video is awareness territory. Performance creative should resolve by 15s.

Platform variations. TikTok performs at 15 to 30 seconds; the platform tolerates longer because the audience is in a longer dwell mode. Meta In-Feed performs at 15s. YouTube Shorts at 15 to 60s. Long-form YouTube at 30s+ for awareness, with the value prop still front-loaded.

---

## Variation systems

The systematic way to produce 20 to 50 ad variations from one core concept without manual creative authoring per variation.

The decomposition. A creative is a hook plus a body plus a CTA in a format. Treat each as a variable.

- 1 concept times 5 hooks times 4 bodies times 3 CTAs times 2 formats equals 120 theoretical variations.
- Most are not worth shipping. The matrix narrows to 20 to 40 variations the team will actually run.
- Asset library structure: organize by concept, not by date. `concepts/launch-2026/hooks/`, `concepts/launch-2026/bodies/`, etc.

Naming convention. Use a structured naming system so the analyst can join performance data back to creative components. Example: `launch2026_meta-reel_hookA_bodyB_ctaC_v1`. The analyst pulls the report, joins on the naming components, and identifies which hook is winning across body and CTA combinations.

Worked example in [`references/creative-variation-templates.md`](references/creative-variation-templates.md). A half-day production session produces 40 variations from one core concept by using the matrix. Without the matrix, the same 40 variations require five days of authoring overhead.

---

## Sequential testing methodology

The waterfall. Most teams test everything at once and lose the signal. Sequential testing isolates the variable that matters at each step.

1. **Test hooks first.** 5 to 10 hook variants, same body, same CTA, same format. The hook is the biggest lever; isolate it first.
2. **Winners advance to body testing.** Top 2 to 3 hooks each get 5 to 10 body variants. Now you are testing what the audience watches after the hook lands.
3. **Winners advance to CTA testing.** Top hook plus body combinations each get 3 to 5 CTAs. Smaller search space at this stage; the differences are usually marginal.
4. **Winners advance to format testing.** Top combinations each render in 2 to 3 formats (vertical video, carousel, static). Catches format-specific drop-offs.
5. **Top combos go into evergreen rotation.** Two to four winners run on rotation. Refresh on the cadence below.

The common mistake. Testing all variables at once. Variance compounds; the team cannot tell whether the hook, the body, the CTA, or the format made the difference. Sequential is slower but produces real learnings the team can apply to the next campaign.

Detail in [`references/testing-cadence-playbook.md`](references/testing-cadence-playbook.md).

---

## Creative fatigue detection

Fatigue is real. The same audience seeing the same creative six times a week tunes it out, or worse, develops negative associations. Five signals indicate fatigue.

1. **Frequency above 4 to 5 per user per week.** Set explicit caps. Defaults are usually too high.
2. **CTR declining 30%+ week over week.** The creative is no longer fresh to the audience.
3. **CPM increasing without audience saturation explanation.** The platform is having to bid harder to deliver impressions because engagement signals are weakening.
4. **Negative comments increasing.** A direct user signal that the audience is irritated.
5. **Hide ratio increasing.** Meta exposes this as "negative feedback rate." TikTok exposes "not interested" rate.

Refresh cadence. Weekly for high-spend campaigns ($50K+/month). Biweekly for medium spend. Monthly for low spend. The economics: producing a fresh variant is cheaper than running tired creative for one extra week.

The decision tree. If a top performer's metrics are still strong but frequency is climbing, ship variants of the same concept (same hook structure, different copy and visuals). If the metrics are dropping, retire the concept and ship a new one. Detail in [`references/fatigue-detection-checklist.md`](references/fatigue-detection-checklist.md).

---

## Brand-voice alignment without conversion dilution

The tension. Brand voice can feel off-brand when squeezed into 15-second ads. The fix is hierarchy, not compromise.

Voice attributes that survive compression. Tone (playful, serious, expert, irreverent). Cadence (short sentences vs long-form). Vocabulary (industry-specific or accessible). Visual treatment (color, type, motion language). These survive in 15s because they live in the texture of every frame.

Voice attributes that do not survive compression. Deep narrative arcs. Complex metaphors. Layered humor that requires setup. Long-form storytelling. These need 30s+ of runtime to land. Forcing them into 15s produces diluted versions that read as off-brand.

The hierarchy. Brand voice in every frame; performance discipline in the structure. The brand voice shows up in tone, cadence, vocabulary, and visual treatment. The performance discipline shows up in pacing, hook strength, and CTA placement.

A worked example. A brand whose voice is "warm and direct, slightly contrarian, plain-language" runs three creatives. The 60-second YouTube awareness piece has the founder talking to camera, plain language, contrarian framing of the category. The 15-second Meta performance ad has fast cuts, plain language captions on screen, contrarian hook ("Stop overpaying for project management software"), specific value prop, CTA. The static carousel has 6 cards, plain language, contrarian opening card, value prop progression, CTA on the last card. Same voice. Different structure. None feels off-brand to a customer who has seen all three.

Detail in [`references/brand-voice-performance-balance.md`](references/brand-voice-performance-balance.md).

---

## Platform-specific creative norms

Each platform has native norms. Violating them tanks performance. The fix is producing platform-native, not repurposing.

**Meta (Facebook plus Instagram).** In-feed visual hierarchy. Captions on by default (most users watch sound-off). Native-feeling production beats studio production for direct response. Vertical 9:16 for Reels and Stories; 1:1 or 4:5 for in-feed. CTAs above the fold or in first 2 lines of caption.

**TikTok.** Vertical 9:16 only. Native-creator aesthetic; phone-shot is the default. Fast cuts every 1 to 2 seconds. Captions for accessibility. Music-driven; trending sounds compound reach but expire fast. Spark Ads (boost an existing organic post) consistently outperform pure paid because they retain organic engagement signal.

**LinkedIn.** Professional tone. Slower pacing tolerated; B2B audiences are in research mode rather than scroll mode. B2B vocabulary is fine; consumer-style copy reads as off-platform. Thought leadership angle works; product pitches feel salesy.

**Google Search.** Text-only headlines plus descriptions. Character limits are real constraints (30-character headlines, 90-character descriptions). RSA (Responsive Search Ads) optimization rewards 15+ headline variations and 4+ descriptions; the platform mixes them.

**Google Display and YouTube.** Depends on placement. YouTube allows longer narrative (15s to 6m); Display is fast banner-style. Skippable YouTube ads need to earn the next second of attention; non-skippable annoys.

Detail in [`references/platform-creative-norms.md`](references/platform-creative-norms.md).

---

## Common failures

Eight patterns recur across creative production work. The short version.

- "We made a beautiful brand video and ran it as performance." Wrong format and length for the channel. Brand video belongs in awareness; performance ads need the 15-second structure.
- "All our ads use the same hook." Saturation. Ship five to ten hook variants per concept and rotate.
- "Our ads stopped working after 3 days." Fatigue plus narrow audience. Either ship more variants or expand th
