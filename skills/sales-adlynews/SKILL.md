---
name: sales-adlynews
description: adly.news platform help — two-sided newsletter advertising marketplace connecting publishers with advertisers, featuring verified ESP metrics, in-app negotiation, ad slot management, and Stripe payments. Use when you want to list your newsl
source: github:sales-skills/sales
---

# adly.news Platform Help

## Step 1 — Gather context

If `references/learnings.md` exists, read it first for accumulated platform knowledge.

1. **What are you trying to do?**
   - A) List my newsletter on adly.news to attract sponsors
   - B) Buy ad placements in newsletters as an advertiser
   - C) Manage ad slots (pricing, dates, availability)
   - D) Compare adly.news to other newsletter sponsorship platforms
   - E) Create a campaign to recruit newsletters for my brand

2. **Which side of the marketplace are you on?**
   - A) Publisher (I have a newsletter and want sponsors)
   - B) Advertiser (I want to buy newsletter ad placements)

3. **Newsletter size** (if publisher): subscriber count and open rate

Skip-ahead rule: if the user's prompt already contains enough context, skip to Step 2.

## Step 2 — Route or answer directly

| If the question is about... | Route to... |
|---|---|
| Newsletter monetization strategy (subscriptions, pricing, ad revenue models) | `/sales-newsletter [question]` |
| Programmatic ad network or large publisher marketplace | `/sales-paved [question]` |
| Sponsor intelligence with API, competitor monitoring, spend trends | `/sales-sponsorgap [question]` |
| Sponsor intelligence with ad creative screenshots | `/sales-whosponsorsstuff [question]` |
| Curated sponsor lead list with weekly updates | `/sales-sponsorleads [question]` |
| Managing sponsor operations (invoices, CRM, reporting) | `/sales-sponsy [question]` |
| Growing your subscriber list | `/sales-audience-growth [question]` |

If the question is adly.news-specific, continue to Step 3.

## Step 3 — adly.news platform reference

**Read `references/platform-guide.md`** for the full platform reference — capabilities, comparison with alternatives, workflows for publishers and advertisers.

Answer the user's question using only the relevant section. Don't dump the full reference.

## Step 4 — Actionable guidance

Focus on the user's specific situation:

- **Publisher getting started**: Create your adly.news listing, set up ad slots with pricing based on CPM, write descriptions that highlight audience demographics. The verified metrics feature pulls data from your ESP automatically.
- **Advertiser finding newsletters**: Browse listings with verified metrics, use campaigns to attract newsletters to you, or book ad slots directly. Start with small test placements before committing to packages.
- **Choosing adly.news vs alternatives**: adly.news is best for indie publishers wanting a simple marketplace with verified metrics and negotiation. For larger operations, Paved (programmatic + 3,000+ publishers) may be better. For prospecting sponsor contacts without a marketplace, use SponsorGap or Who Sponsors Stuff.

If you discover a gotcha, workaround, or tip not covered in `references/learnings.md`, append it there.

## Gotchas

> *Best-effort from research — review these, especially items about plan-gated features and integration gotchas that may be outdated.*

1. **No API, no webhooks, no Zapier/Make**: All operations are through the web interface only. No programmatic access to listings, campaigns, or data.
2. **Commission rate not publicly disclosed**: adly.news takes a cut of transactions but the exact percentage is not stated. Ask before listing.
3. **Small/new marketplace**: Newer than Paved or Hecto. Inventory may be limited in certain niches — supplement with direct outreach or other marketplaces.
4. **Verified metrics depend on ESP integration**: Metrics are pulled from ESPs like Beehiiv and Kit. If your ESP isn't supported, metrics may not be auto-verified.
5. **Stripe-only payments**: No alternative payment methods. Both publishers and advertisers need Stripe accounts.

## Related skills

- `/sales-newsletter` — Newsletter monetization strategy (paid subscriptions, sponsorships, ad sales, pricing)
- `/sales-hecto` — Hecto newsletter advertising marketplace (self-serve, transparent pricing, direct creator messaging)
- `/sales-paved` — Paved newsletter sponsorship marketplace, Ad Network, Booker, Radar
- `/sales-sponsorgap` — SponsorGap sponsor intelligence (38K+ brands, verified contacts, competitor monitoring, spend trends, API)
- `/sales-whosponsorsstuff` — Who Sponsors Stuff sponsor intelligence (8,000+ sponsors, ad creative screenshots, email alerts)
- `/sales-sponsorleads` — SponsorLeads sponsor lead lists (4,318+ companies, decision-maker contacts, Airtable database)
- `/sales-openrates` — Open Rates sponsor prospecting database (10,000+ active sponsors, decision-maker contacts)
- `/sales-sponsy` — Sponsy sponsorship operations (ad inventory calendar, sponsor CRM, customer portals, reporting)
- `/sales-buysellads` — BuySellAds contextual advertising marketplace (managed ad sales, Carbon Ads, Ad Serving API)
- `/sales-socialpresence` — Social Presence AI-powered newsletter advertising marketplace (discovery dashboard, Ad Library, managed sales)
- `/sales-do` — Not sure which skill to use? The router matches any sales objective to the right skill. Install: `npx skills add sales-skills/sales --skill sales-do`

## Examples

### Example 1: Publisher listing their newsletter
**User says**: "I have a 3,000-subscriber tech newsletter with 38% open rate. How do I get sponsors through adly.news?"
**Skill does**: Walks through creating an adly.news listing, setting up ad slot types and pricing based on CPM benchmarks, writing audience descriptions, and enabling verified metrics from their ESP
**Result**: User has a live adly.news listing with verified metrics attracting self-serve sponsor bookings

### Example 2: Advertiser creating a campaign
**User says**: "I want to advertise my developer tool in newsletters. Can I create a campaign on adly.news to attract publishers?"
**Skill does**: Explains the campaign feature where advertisers describe their target audience and budget, newsletters browse and apply to campaigns, and the advertiser selects the best fits
**Result**: User has an active campaign attracting relevant newsletter publishers

### Example 3: Comparing adly.news to alternatives
**User says**: "Should I use adly.news or Hecto to sell newsletter sponsorships?"
**Skill does**: Compares both marketplaces — adly.news has verified ESP metrics and bidding/negotiation vs Hecto's transparent upfront pricing and date-specific inventory. Both are UI-only with no API. Recommends based on publisher's needs.
**Result**: User picks the right marketplace for their situation

## Troubleshooting

### Not enough advertisers finding my newsletter
**Symptom**: Listed on adly.news but no sponsor inquiries
**Cause**: Small marketplace, weak listing description, or pricing misaligned with audience size
**Solution**: Supplement with direct outreach using SponsorGap or Who Sponsors Stuff to find active sponsors. Also list on Paved (3,000+ publishers) for more visibility. Improve your listing with specific audience demographics and engagement proof.

### Unsure about ad slot pricing
**Symptom**: Don't know what to charge for ad placements
**Cause**: No benchmark data available on the platform
**Solution**: Calculate using CPM: subscribers x open rate x CPM / 1000. Start at $25-$50 CPM for general interest, $50-$100+ for B2B/finance niches. See `/sales-newsletter` for detailed pricing guidance.

### Can't automate sponsor workflows
**Symptom**: Want to sync sponsor data to CRM or automate reporting
**Cause**: adly.news has no API, webhooks, or integration support
**Solution**: For automated sponsor operations, use Sponsy (Zapier integration, sponsor CRM, automated reporting). For API-accessible sponsor data, use SponsorGap.
