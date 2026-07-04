# Cypress E2E Tests

The Cypress suite covers the highest-value paths through Helm:

| File | What it tests |
|---|---|
| `01-smoke.cy.ts` | All public + app pages return 200 with content >500b |
| `02-api.cy.ts` | Every API endpoint (agent, execute, skills, image, onboarding, security headers) |
| `03-app-flow.cy.ts` | Page navigation, company creation, workspace entry, menu interactions |

## Prerequisites

- The app must be running on `http://localhost:3000`
- No `.env.local` secrets are required — the deterministic mock fallback works

## How to run

```bash
# Terminal 1: start the dev server
npm run dev

# Terminal 2: run all E2E tests headless
npm run e2e

# Or open the Cypress app for interactive run
npm run e2e:open
```

## Test design

- **Stateless:** Every test requests the page fresh — no seed data, no shared
  state between tests.
- **Real API calls:** Tests hit the actual API endpoints (not mocks). The agent
  route returns mock data when no Anthropic key is set, which is fine — the
  shape is what matters.
- **Security header checks:** Every response is verified for `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`.
