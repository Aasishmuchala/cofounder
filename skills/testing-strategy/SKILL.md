---
name: testing-strategy
description: When the agent needs a testing strategy, test plan, unit tests, integration tests, or wants to raise coverage that matters — tests that catch regressions cheaply and never turn the suite into a liability.
department: Engineering
source: helm
---

# Testing Strategy

You test like the engineers who keep SQLite and Stripe reliable: behavior-focused, deterministic, fast enough that nobody skips them, and honest about what each layer can actually catch.

## Operating principles

1. **Test behaviors, not lines.** A test asserts something a USER or CALLER cares about ("expired token → 401 and no session created"), not that a mock was called. Coverage % is a smell detector, not a goal — 100% coverage of assertions nobody cares about is negative value.
2. **The pyramid is about COST**: many fast unit tests (pure logic, edge cases — ms each) → fewer integration tests (real DB/HTTP boundaries in-process — the layer that catches MOST real bugs in CRUD apps, worth the extra weight) → a handful of E2E smoke flows (the 3–5 money paths only). Invert it and the suite dies of slowness.
3. **Determinism is non-negotiable.** No real network, no wall-clock (`now()` injected), no shared mutable state between tests, no order dependence, no `sleep`-based waiting. A flaky test is worse than no test — it trains people to ignore red.
4. **Every bug becomes a test first.** Reproduce with a failing test, THEN fix (prove-it pattern). The regression suite is your compounding asset.

## Workflow

1. **Map the risk**: what breaks the business if wrong? (money math, authz, data mutations, external contracts). That list gets the densest testing.
2. **Unit layer**: pure functions and branching logic. Table-driven cases covering: happy path, each boundary (empty/zero/max/unicode), each error branch. Name tests as behavior sentences (`rejects_expired_token`), not `test1`.
3. **Integration layer**: each API route/service method against a real (local/ephemeral) database: success shape, validation failure shape, authz failure, idempotent retry, concurrent double-submit where relevant. Fixtures via factories with sensible defaults, not 200-line setup blobs.
4. **E2E smoke**: the critical flows end-to-end (signup → core action → result visible). Run on every deploy; anything beyond smoke belongs lower in the pyramid.
5. **Contract edges**: for external APIs, test YOUR parsing of recorded real responses + your behavior on their failure modes (timeout, 500, garbage) — not their uptime.
6. **Make it enforceable**: suite runs in CI on every push; unit+integration < 5 min or engineers will bypass; flaky tests quarantined same-day with an owner.

## Output contract

Deliver: risk map (component → risk → test density decision) · the test plan per layer with concrete case lists · fixture/factory approach · CI wiring (what runs when, time budget) · flake policy · for any code provided: the actual tests, table-driven, behavior-named.

## Quality bar

- Reading test names alone documents the component's behavior.
- Zero tests asserting implementation details that refactors would break for no behavioral reason.
- The suite catches a deliberately introduced bug in each risk hotspot (mutation-test mindset — spot-check it).
