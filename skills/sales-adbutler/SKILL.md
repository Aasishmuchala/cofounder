---
name: sales-adbutler
description: AdButler platform help — full-stack ad server for display, video, mobile, native, and email ads with self-serve advertiser portal, programmatic SSP, REST API, MCP server, and cookieless targeting. Use when setting up AdButler to monetize yo
source: github:sales-skills/sales
---

# AdButler Platform Help

## Step 1 — Gather context

If `references/learnings.md` exists, read it first for accumulated platform knowledge.

1. **What are you trying to do?**
   - A) Set up AdButler to serve ads on my website or newsletter
   - B) Configure the self-serve portal for advertisers
   - C) Integrate via the REST API or MCP server
   - D) Troubleshoot ad rendering or delivery issues
   - E) Compare AdButler to other ad servers
   - F) Set up programmatic demand (SSP/RTB)

2. **Which side are you on?**
   - A) Publisher (I have a site/newsletter and want ad revenue)
   - B) Advertiser (I want to place ads)
   - C) Developer (building a custom ad platform or integration)

3. **Current setup** (if applicable): channel (web, email, app), monthly ad requests, current ad server

Skip-ahead rule: if the user's prompt already contains enough context, skip to Step 2.

## Step 2 — Route or answer directly

| If the question is about... | Route to... |
|---|---|
| Newsletter monetization strategy (subscriptions, pricing models) | `/sales-newsletter [question]` |
| Sponsorship marketplace (finding sponsors) | `/sales-paved [question]` or `/sales-hecto [question]` |
| Sponsor intelligence (brands that sponsor newsletters) | `/sales-sponsorgap [question]` |
| Building a custom ad platform from scratch (API-first) | `/sales-kevel [question]` |
| Email deliverability (SPF/DKIM/DMARC) | `/sales-deliverability [question]` |

If the question is AdButler-specific, continue to Step 3.

## Step 3 — AdButler platform reference

**Read `references/platform-guide.md`** for the full platform reference — capabilities, pricing, data model, email ad setup, integration recipes, code examples.

**Read `references/adbutler-api-reference.md`** for API endpoint details, authentication, ad serving JSON API, and MCP server setup.

Answer the user's question using only the relevant section. Don't dump the full reference.

## Step 4 — Actionable guidance

Focus on the user's specific situation:

- **Publisher getting started**: Create a publisher, add zones (email or web), generate zone tags, paste into your template. Start with 1-2 zones, monitor for 2-4 weeks.
- **Email newsletters**: Use email-type zones — image-only ads. Generate zone tag with your ESP's EUID macro. Paste HTML into template. Ads can be updated after send.
- **Self-serve portal**: Enable the self-serve module, configure advertiser registration, set approval workflows and payment processing. Advertisers manage their own campaigns.
- **API integration**: API Access is a paid add-on. Use Bearer token auth against `api.adbutler.com/v2/`. For ad serving, use the JSON API at `servedbyadbutler.com/adserve` (no auth needed).
- **MCP server**: Install with `claude mcp add adbutler -- npx -y @adbutler/mcp-server`. Manage campaigns, pull reports, and automate ad ops through natural language.
- **Choosing AdButler vs alternatives**: AdButler is best for publishers wanting a managed ad server with self-serve portal and email support at $179/mo+. For API-first custom builds, use Kevel. For free/open-source, consider Revive Adserver. For programmatic-only newsletter ads with no setup, use Admailr or Paved.

If you discover a gotcha, workaround, or tip not covered in `references/learnings.md`, append it there.

## Gotchas

> *Best-effort from research — review these, especially items about plan-gated features and integration gotchas that may be outdated.*

1. **API Access is a paid add-on** on all plans — you must add it to your subscription before API keys work. Budget for this if building integrations.
2. **Email zones are image-only** — almost all email clients block Rich Media/Custom HTML ads. Only image creatives work in email zones.
3. **Essentials plan caps at 10 zones and 10 advertisers** — if you need more, you must upgrade to Standard ($682/mo). Check zone/advertiser limits before committing.
4. **Impressions only count on first load** — email ad impressions are recorded when the image loads, but cached images don't re-trigger. Clicks are always tracked.
5. **iOS 15 Mail Privacy Protection** inflates email open counts — MPP pre-fetches images. CPC metrics are more reliable than CPM for email. Regenerate zone tags created before Oct 2021.
6. **Targeting is a paid add-on** — geo, behavioral, and contextual targeting require the targeting add-on on top of your base plan.

## Related skills

- `/sales-newsletter` — Newsletter monetization strategy (paid subscriptions, sponsorships, ad sales, pricing)
- `/sales-kevel` — Kevel API-first ad server infrastructure (build custom ad platforms, Decision API)
- `/sales-admailr` — Admailr programmatic email ad server (automated ad insertion, CPM+CPC, no setup)
- `/sales-paved` — Paved newsletter sponsorship marketplace, Ad Network
- `/sales-buysellads` — BuySellAds contextual advertising marketplace (managed ad sales, Carbon Ads)
- `/sales-passendo` — Passendo email ad server + SSP (programmatic exchange, direct-sold campaigns)
- `/sales-postapex` — PostApex newsletter ad network (500+ publishers, CPC, free for publishers)
- `/sales-hecto` — Hecto newsletter advertising marketplace (self-serve, transparent pricing)
- `/sales-deliverability` — Email deliverability strategy (SPF, DKIM, DMARC, warmup)
- `/sales-do` — Not sure which skill to use? The router matches any sales objective to the right skill. Install: `npx skills add sales-skills/sales --skill sales-do`

## Examples

### Example 1: Publisher setting up email ads
**User says**: "I have a 20K-subscriber newsletter on Mailchimp. How do I add AdButler ads?"
**Skill does**: Walks through creating an email zone, configuring dimensions, adding image ad items, generating the zone tag with Mailchimp's EUID macro (`*|CAMPAIGN_UID|*-*|UNIQID|*`), and pasting the HTML into the Mailchimp template
**Result**: User has AdButler email ads running in their newsletter with click tracking

### Example 2: API integration for reporting
**User says**: "How do I pull campaign performance data from AdButler's API into my dashboard?"
**Skill does**: Shows the Reporting API at `api.adbutler.com/v2/reports` with Bearer auth, required parameters (type, period), response format with impressions/clicks/revenue, and a working cURL + Python example
**Result**: User has working API scripts to pull ad performance data programmatically

### Example 3: Choosing between ad servers
**User says**: "I'm a mid-size publisher with 5M monthly pageviews. Should I use AdButler, Kevel, or Google Ad Manager?"
**Skill does**: Compares all three: AdButler ($230/mo for 5M requests, managed dashboard + self-serve portal, email support), Kevel ($5K+/mo, API-only, requires engineering), GAM (free but complex, Google lock-in). Recommends AdButler for publishers wanting control without building from scratch.
**Result**: User has a clear comparison with pricing and trade-offs for their scale

## Troubleshooting

### Email ads not rendering in some clients
**Symptom**: Ad images appear broken or missing in Outlook, Gmail, or dark mode
**Cause**: Email clients handle image rendering differently; some block remote images by default, dark mode inverts colors
**Solution**: Use only image-type creatives in email zones. Test across clients with Litmus or Email on Acid. For dark mode, avoid transparent backgrounds — use solid backgrounds that work in both light and dark mode. Regenerate zone tags if they were created before the iOS 15 MPP or Outlook image-blocking updates.

### API returns 401 Unauthorized
**Symptom**: Management API calls fail with authentication errors
**Cause**: API Access add-on not enabled, or incorrect auth header format
**Solution**: Verify the API Access add-on is active on your subscription (Settings > Subscription). Use Bearer token: `Authorization: Bearer YOUR_API_KEY`. Optionally whitelist your server IP in Settings > API.

### Self-serve advertisers can't see their campaigns
**Symptom**: Advertisers who signed up through the self-serve portal report empty dashboards
**Cause**: Campaigns require approval before going live, or the advertiser account isn't linked to the correct publisher
**Solution**: Check the approval queue in your AdButler dashboard. Verify the self-serve portal configuration maps to the correct publisher and zone inventory. Ensure the advertiser's payment method is active.
