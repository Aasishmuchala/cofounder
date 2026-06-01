---
name: sales-adglare
description: AdGlare platform help — cloud-based ad server for publishers and advertisers with display, native, VAST video, CTV, redirect, and catalog ad formats, cookieless targeting, real-time reporting, and REST API v2 (Enterprise plan only). Use whe
source: github:sales-skills/sales
---

# AdGlare Platform Help

## Step 1 — Gather context

If `references/learnings.md` exists, read it first for accumulated platform knowledge.

1. **What are you trying to do?**
   - A) Set up AdGlare to serve display ads on my website
   - B) Serve native ads via JSON endpoint
   - C) Set up VAST video or CTV ad serving
   - D) Automate campaign management via the API
   - E) Compare AdGlare to other ad servers

2. **Your role?**
   - A) Publisher (monetizing my own site/app)
   - B) Advertiser (placing ads on publisher sites)
   - C) Ad agency (managing multiple clients)

3. **Current plan**: Lite (€99/mo), Professional (€499/mo), or Enterprise (€649/mo)?

Skip-ahead rule: if the user's prompt already contains enough context, skip to Step 2.

## Step 2 — Route or answer directly

| If the question is about... | Route to... |
|---|---|
| Email newsletter ad serving | AdGlare has NO email zones. Use `/sales-adbutler`, `/sales-adspeed`, or `/sales-revive` |
| Newsletter monetization strategy | `/sales-newsletter [question]` |
| Programmatic RTB exchange | `/sales-epom [question]` |
| Self-hosted free ad server | `/sales-revive [question]` |
| API-first custom ad platform | `/sales-kevel [question]` |

If the question is AdGlare-specific, continue to Step 3.

## Step 3 — AdGlare platform reference

**Read `references/platform-guide.md`** for the full platform reference — capabilities, pricing, zone types, API overview, integration recipes, code examples.

Answer the user's question using only the relevant section. Don't dump the full reference.

## Step 4 — Actionable guidance

Focus on the user's specific situation:

- **Publisher getting started**: Create a workspace, set up zones (display/native/VAST/redirect/catalog), create campaigns with targeting rules, link creatives to campaigns, get the ad tag or JSON endpoint, paste into your site template.
- **Native ads**: Create a native zone, fetch JSON from the zone endpoint, render with your own HTML template. Response includes title, description, image, CTA fields.
- **Video ads**: Create a VAST zone, get the VAST tag URL, configure your video player (JW Player, Video.js, etc.) to use it as a pre/mid/post-roll source.
- **API automation**: Enterprise plan required (€649/mo). Bearer token auth, base URL `https://{name}.api.adglare.app/v2`. Full CRUD on workspaces, campaigns, zones, creatives.
- **Choosing AdGlare vs alternatives**: AdGlare is best for publishers needing a premium hosted ad server with display, native, and video support, cookieless by design. For email newsletter ads, use AdButler or AdSpeed. For self-hosted free, use Revive. For API-first custom builds, use Kevel.

If you discover a gotcha, workaround, or tip not covered in `references/learnings.md`, append it there.

## Gotchas

> *Best-effort from research — review these, especially items about plan-gated features that may be outdated.*

1. **No email newsletter zones** — AdGlare supports display, native, VAST, redirect, and catalog zones only. If you need email ad serving, use AdButler, AdSpeed, Broadstreet, or Revive Adserver instead.
2. **API is Enterprise-only (€649/mo)** — the REST API v2 is not available on Lite (€99) or Professional (€499) plans. If you need API access on a budget, consider AdSpeed (API on all plans) or Epom (API from $250/mo).
3. **Native ads are Enterprise-only** — native ad format zones require the Enterprise plan.
4. **Impression tracking near plan limits** — users report inaccurate counting when approaching monthly impression caps. Monitor usage proactively and consider a buffer.
5. **Limited DSP/exchange integrations** — AdGlare has fewer native programmatic connections than platforms like OpenX or PubMatic. You may need custom integration work for programmatic demand.

## Related skills

- `/sales-adbutler` — AdButler full-stack ad server (email ad zones, self-serve portal, REST API + MCP)
- `/sales-adspeed` — AdSpeed affordable hosted ad server (email newsletter zones, REST API with MD5 auth)
- `/sales-epom` — Epom hosted ad server + white-label DSP (API included, RTB free for publishers)
- `/sales-revive` — Revive Adserver free open-source self-hosted ad server (email zones, XML-RPC API)
- `/sales-kevel` — Kevel API-first ad server infrastructure (build custom ad platforms, Decision API)
- `/sales-broadstreet` — Broadstreet ad manager for local/B2B publishers (newsletter ad zones, direct-sold ads)
- `/sales-newsletter` — Newsletter monetization strategy (subscriptions, sponsorships, ad sales, pricing)
- `/sales-do` — Not sure which skill to use? The router matches any sales objective to the right skill. Install: `npx skills add sales-skills/sales --skill sales-do`

## Examples

### Example 1: Setting up display ads on a publisher website
**User says**: "I just signed up for AdGlare Lite. How do I get display ads showing on my site?"
**Skill does**: Walks through creating a workspace, setting up a display zone with dimensions, creating a campaign with targeting and flight dates, uploading image/HTML5 creatives, linking the campaign to the zone, and getting the async JavaScript ad tag to paste into the site template
**Result**: User has display ads serving on their website with proper tracking

### Example 2: Automating campaign management via the API
**User says**: "How do I use the AdGlare API to create campaigns and pull reporting data?"
**Skill does**: Explains Enterprise plan requirement (€649/mo), demonstrates Bearer token auth, shows campaign creation with POST /campaigns endpoint including targeting/pacing fields, explains that Reports endpoint exists but docs were partially available, provides working cURL and Python examples
**Result**: User understands API access requirements and has working integration code

### Example 3: Choosing between ad servers
**User says**: "I publish a niche blog with 500K monthly pageviews and a weekly newsletter. Should I use AdGlare or AdButler?"
**Skill does**: Compares both: AdGlare (€99/mo Lite for 1M impressions, no email zones, cookieless, 220+ CDN nodes, API only on Enterprise) vs AdButler ($179/mo, email ad zones, self-serve portal, MCP server, REST API on all plans). Notes that AdGlare lacks email/newsletter zones, so for the newsletter component, AdButler or AdSpeed is needed.
**Result**: User picks the right ad server for their specific needs (web + newsletter)

## Troubleshooting

### Ads not delivering impressions
**Symptom**: Campaign is active but zone shows zero impressions
**Cause**: Campaign not linked to the correct zone, flight dates haven't started, or targeting rules are too restrictive
**Solution**: Verify the campaign is linked to an active zone, check that flight dates include today, review targeting rules (geo, time, frequency) to ensure they match your audience. Check the real-time reporting dashboard for serving errors.

### Native JSON endpoint returning empty
**Symptom**: Fetching the native zone URL returns no ad data
**Cause**: No active campaign with native creatives linked to the zone, or you're on a plan below Enterprise
**Solution**: Native ads require the Enterprise plan (€649/mo). Verify you have a campaign with native creatives (title, description, image, CTA) linked to the native zone. Test the zone URL directly in a browser to see the raw JSON response.

### Can't access the API
**Symptom**: API requests return authentication errors or 403
**Cause**: Your plan doesn't include API access — it's Enterprise-only (€649/mo)
**Solution**: Upgrade to the Enterprise plan. If budget is a constraint, consider AdSpeed (API on all plans from $9.95/mo), Epom (API from $250/mo), or Revive Adserver (free, self-hosted, XML-RPC API).
