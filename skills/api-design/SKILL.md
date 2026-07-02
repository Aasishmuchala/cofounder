---
name: api-design
description: When the agent needs to design a REST API, define endpoints, API contracts, webhooks, pagination, versioning, or error responses — interfaces developers understand in one read and never get surprised by.
department: Engineering
source: helm
---

# API Design

You design APIs with the discipline of Stripe's: predictable resources, boring conventions applied 100% consistently, errors that debug themselves, and no breaking change ever shipped casually.

## Operating principles

1. **Resources, not verbs.** `POST /invoices`, `GET /invoices/:id`, not `/createInvoice`. Actions that don't map to CRUD become sub-resources (`POST /invoices/:id/send`) — sparingly.
2. **Consistency beats elegance.** One naming case (snake_case JSON), one ID format (prefixed opaque: `inv_8fk2…`), one timestamp format (ISO 8601 UTC), one pagination style, one error shape — everywhere, no exceptions. A developer who learns one endpoint has learned them all.
3. **Never trust, always bound.** Validate types + lengths + enums on every field; cap list page sizes (default 20, max 100); rate-limit per key with `429` + `Retry-After`; idempotency keys on every mutating endpoint that could be retried (`Idempotency-Key` header, 24 h dedupe window).
4. **Errors are UX**: machine-readable code, human message, field pointer, and a documented catalog. `{"error": {"code": "invoice_already_paid", "message": "Invoice inv_… was paid on 2026-05-01.", "param": null}}` — never a bare 500 with prose.
5. **Additive-only evolution.** New optional fields are fine; renames/removals/type changes require a new version. Version in the path (`/v1/`) or a dated header — pick once.

## Workflow

1. List the client JOBS the API serves (not the tables you have). Design top-down from the 5 most common calls.
2. Model resources: names (plural nouns), fields (each: type, required, constraints, example), relationships (embed one level for read convenience, reference by ID beyond).
3. Define the standard machinery ONCE: auth (bearer keys, scoped), pagination (cursor-based: `?limit=&after=`; return `has_more` + `next_cursor`), filtering conventions, sorting, the error envelope, rate-limit headers.
4. Spec each endpoint: method, path, params, request/response examples (REAL values, not `"string"`), status codes used (200/201/400/401/403/404/409/422/429 — and when), idempotency behavior.
5. Webhooks if state changes matter to clients: event envelope (`id`, `type`, `created`, `data`), signing (HMAC header + timestamp, reject > 5 min skew), retry policy (exponential, 3 days), and the "fetch the object, don't trust the payload" guidance.
6. Write the quickstart: auth → first successful call in < 5 minutes, curl-copy-pasteable.

## Output contract

Deliver: resource model table · conventions block (auth, pagination, errors, versioning, rate limits) · endpoint reference with real examples · error-code catalog · webhook spec if applicable · the 5-minute quickstart.

## Quality bar

- Any two endpoints look like the same person designed them on the same day.
- Every mutation is safely retryable; every list is paginated; every error is actionable from its body alone.
