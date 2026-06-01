---
name: sales-admailr
description: Admailr platform help — programmatic email ad server for newsletter publishers with automated ad insertion, campaign management REST API, CPM+CPC revenue model, and ESP integrations. Use when you want to monetize your newsletter with automa
source: github:sales-skills/sales
---

# Admailr Platform Help

## Step 1 — Gather context

If `references/learnings.md` exists, read it first for accumulated platform knowledge.

1. **What are you trying to do?**
   - A) Set up Admailr to monetize my newsletter with ads
   - B) Manage ad campaigns via the API
   - C) Troubleshoot ad rendering or delivery issues
   - D) Compare Admailr to other email ad networks
   - E) Integrate Admailr ad tags into my ESP

2. **Which side are you on?**
   - A) Publisher (I have a newsletter and want ad revenue)
   - B) Advertiser (I want to place ads in newsletters)

3. **Newsletter details** (if publisher): ESP, subscriber count, current ad setup

Skip-ahead rule: if the user's prompt already contains enough context, skip to Step 2.

## Step 2 — Route or answer directly

| If the question is about... | Route to... |
|---|---|
| Newsletter monetization strategy (subscriptions, pricing models) | `/sales-newsletter [question]` |
| Sponsorship marketplace (direct sponsor deals) | `/sales-paved [question]` or `/sales-hecto [question]` |
| Sponsor intelligence (finding brands that sponsor newsletters) | `/sales-sponsorgap [question]` |
| Managing sponsor operations (invoices, CRM, reporting) | `/sales-sponsy [question]` |
| Growing your subscriber list | `/sales-audience-growth [question]` |
| Email deliverability (SPF/DKIM/DMARC) | `/sales-deliverability [question]` |

If the question is Admailr-specific, continue to Step 3.

## Step 3 — Admailr platform reference

**Read `references/platform-guide.md`** for the full platform reference — capabilities, pricing, data model, API integration recipes, code examples.

**Read `references/admailr-api-reference.md`** for API endpoint details, authentication, and request/response formats.

Answer the user's question using only the relevant section. Don't dump the full reference.

## Step 4 — Actionable guidance

Focus on the user's specific situation:

- **Publisher getting started**: Sign up, get your API key, add the ad tag HTML snippet to your ESP template. Start with a single ad zone, monitor CPM/CPC performance for 2-4 weeks before adding more zones.
- **Optimizing revenue**: Test different ad placements (top vs mid vs bottom). Native ads typically outperform display banners in newsletters. Keep ad load to 1-2 placements per issue to avoid subscriber fatigue.
- **API integration**: Use the campaign and banner endpoints to programmatically manage ad creatives. Pagination uses standard page/per_page params.
- **Choosing Admailr vs alternatives**: Admailr is best for small-to-mid publishers wanting automated programmatic ads with no subscriber minimum. For direct sponsor deals, use Paved or Hecto instead. For enterprise-scale, consider LiveIntent or Jeeng.

If you discover a gotcha, workaround, or tip not covered in `references/learnings.md`, append it there.

## Gotchas

> *Best-effort from research — review these, especially items about plan-gated features and integration gotchas that may be outdated.*

1. **$100 minimum payout threshold**: You won't receive payment until earnings reach $100. Monthly payouts on the 20th via PayPal, ACH, or check.
2. **Variable CPC rates**: Each ad pays differently — there's no fixed rate. Revenue depends on advertiser bids, your audience targeting data, and click-through performance.
3. **Dark mode rendering**: Ad images may not render correctly in dark mode email clients. Test creatives across clients before committing to specific banner sizes.
4. **Apple MPP affects attribution**: Mail Privacy Protection pre-fetches images, inflating open counts. Admailr's algorithms account for this, but CPC metrics are more reliable than CPM for measuring actual engagement.
5. **Native ads outside US only**: If your audience is international, only native ad formats are available — no display banners for non-US recipients.

## Related skills

- `/sales-newsletter` — Newsletter monetization strategy (paid subscriptions, sponsorships, ad sales, pricing)
- `/sales-paved` — Paved newsletter sponsorship marketplace, Ad Network, Booker, Radar
- `/sales-buysellads` — BuySellAds contextual advertising marketplace (managed ad sales, Carbon Ads, Ad Serving API)
- `/sales-hecto` — Hecto newsletter advertising marketplace (self-serve, transparent pricing)
- `/sales-adlynews` — adly.news newsletter advertising marketplace (verified ESP metrics, bidding/negotiation)
- `/sales-socialpresence` — Social Presence AI-powered newsletter advertising marketplace
- `/sales-sponsy` — Sponsy sponsorship operations (ad inventory calendar, sponsor CRM, reporting)
- `/sales-sponsorgap` — SponsorGap sponsor intelligence (38K+ brands, verified contacts)
- `/sales-deliverability` — Email deliverability strategy (SPF, DKIM, DMARC, warmup)
- `/sales-do` — Not sure which skill to use? The router matches any sales objective to the right skill. Install: `npx skills add sales-skills/sales --skill sales-do`

## Examples

### Example 1: Publisher setting up Admailr
**User says**: "I have a 5,000-subscriber tech newsletter on ActiveCampaign. How do I add Admailr ads?"
**Skill does**: Walks through signing up, getting the ad tag HTML snippet, placing it in the ActiveCampaign template, configuring ad zone placement, and setting category restrictions for relevant ads
**Result**: User has Admailr ads running in their newsletter with automated targeting

### Example 2: API campaign management
**User says**: "How do I create a new campaign and upload banners via the Admailr API?"
**Skill does**: Shows the POST `/api/campaigns` endpoint with required fields, then POST `/api/campaigns/{id}/banners` for multipart file upload, includes cURL examples and authentication setup
**Result**: User has working API scripts for programmatic campaign and banner management

### Example 3: Low ad revenue
**User says**: "I added Admailr to my newsletter but I'm only making $15/month on 3,000 subscribers"
**Skill does**: Diagnoses likely causes — poor ad placement, low click-through rates, generic audience. Recommends testing native ad formats, moving placement above the fold, and adding audience category targeting. Compares expected revenue range for 3K subscribers.
**Result**: User has a plan to optimize ad placement and realistic revenue expectations

## Troubleshooting

### Ads not rendering in some email clients
**Symptom**: Ad images appear broken or missing in Outlook, Gmail, or dark mode
**Cause**: Email clients handle image rendering differently; some block remote images by default, dark mode inverts colors
**Solution**: Use fallback alt text in your ad tag HTML. Test across clients with Litmus or Email on Acid. For dark mode, use transparent PNG banners or native text-based ad formats instead of display banners.

### Low fill rate — empty ad zones
**Symptom**: Ad zones sometimes show blank space instead of ads
**Cause**: No matching advertiser bid for your audience/category at that moment. Common for small newsletters or niche audiences.
**Solution**: Add backfill — configure a house ad or affiliate link as fallback when no programmatic ad fills. Alternatively, supplement with Paved Ad Network or BuySellAds for additional demand. Ensure your newsletter categories and audience data are accurately configured.

### API key not working
**Symptom**: API calls return 401 Unauthorized
**Cause**: Incorrect API key format or wrong auth method
**Solution**: Use the custom header method: `ADMAILR-ADS-API-KEY: your-key`. If using Bearer auth, format as `Authorization: Bearer your-key`. API keys are available in your Admailr dashboard under account settings.
