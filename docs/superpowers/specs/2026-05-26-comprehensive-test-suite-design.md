# Comprehensive Test Suite Design

## Goal

Build a comprehensive test suite for the World Cup prediction app that protects the main user flows, core scoring logic, and security-sensitive boundaries. The suite should give fast feedback during development while adding higher-confidence browser coverage for the flows that depend on multiple parts of the app working together.

The first implementation should prioritize security and data integrity over visual coverage. Local Supabase/RLS tests are desirable, but they require a reproducible database setup. The plan should estimate that setup before adding it to the first implementation phase.

## Current Context

The project is a Next.js 16 app using React 19, Supabase, Vitest, and server actions. Existing tests are co-located Vitest unit tests under `src/**/*.test.{ts,tsx}` and currently cover pure helpers for:

- Auth redirect safety through `safeNextPath`.
- Scoring and standings calculations.
- Prediction localStorage serialization.
- Pool path, active-pool, copy-validation, copy-prediction, and seed helpers.

The largest gaps are server actions, API routes, React context/component behavior, browser journeys, and real Supabase/RLS validation.

## Recommended Approach

Use a layered comprehensive suite:

1. Keep and expand fast Vitest unit tests for pure rules.
2. Add mocked Vitest integration tests for server actions and route handlers.
3. Add React component/context tests for user-facing state and permissions.
4. Add Playwright E2E tests for the most important full-page journeys.
5. Design a Supabase/RLS security track, but pause before implementing local Supabase until setup effort is estimated.

This approach gives useful coverage quickly without hiding the cost of true database-level security tests.

## Coverage Priorities

### P0: Security And Data Integrity

These tests should block merges:

- Admin actions require an authenticated admin before using the service-role client.
- `getAdminStats` must be admin-gated before it can read aggregate data through the service-role client.
- Cron result sync rejects requests with a wrong bearer token when `CRON_SECRET` is configured.
- Cron result sync behavior when `CRON_SECRET` is missing is explicit and tested.
- Auth callback redirects sanitize the `next` parameter before redirecting.
- Prediction submission requires an authenticated user, an active pool, exactly 72 complete group predictions, and at least 32 knockout predictions.
- Submitted pools cannot be edited or left.
- Non-members cannot load, save, submit, or view restricted pool/match prediction data.
- Join/copy flows reject inactive pools, duplicate joins, invalid copy sources, and copying from the same pool.

### P1: Core Product Logic

These tests protect tournament outcomes:

- Bracket generation from group standings, including fixed round-of-32 slots and variable third-place mappings.
- Third-place qualification and tiebreakers.
- Group standings tiebreakers.
- Score calculation and batch score recalculation.
- ESPN team and knockout schedule mapping.
- Match prediction point previews.
- Copy-on-join row construction and counts.

### P2: User-Facing Behavior

These tests protect meaningful UI behavior:

- Prediction context initializes from localStorage, then merges or replaces from database state correctly.
- Local drafts persist for anonymous users and authenticated users under the correct storage key.
- LocalStorage never becomes the source of truth for submitted state.
- Pool cards expose join, leave, and copy actions with correct disabled/error states.
- Match predictions sheet hides member-only details from non-members.
- Dashboard and leaderboard render empty, loading, error, and populated states.
- Bracket view handles incomplete predictions without crashing.

### P3: E2E Journeys

Playwright should cover a small number of high-value journeys:

- Visitor lands on the home page, browses pools, and starts predicting anonymously.
- User signs up or logs in with a safe `next` redirect and lands back in the intended flow.
- User joins a pool, fills predictions, submits, and sees a locked/submitted state.
- User joins a second pool and copies predictions from a valid source pool.
- User views pool dashboard and leaderboard after submission.
- Non-admin users cannot perform admin-only operations.

E2E tests should focus on integration confidence, not exhaustive score combinations.

## Test Architecture

### Unit Tests

Pure rules should be extracted into small helpers when needed. This keeps tests readable and avoids excessive mocking. Good extraction candidates include:

- Prediction submission completeness validation.
- Cron authorization checks.
- Callback redirect sanitization.
- ESPN event normalization.
- Pool summary/rank calculations.
- Admin authorization decision logic.

Unit tests should stay co-located with source files and follow the existing Vitest style.

### Mocked Integration Tests

Server actions and route handlers should be tested by mocking module boundaries:

- Mock `createClient` for user-scoped Supabase behavior.
- Mock `createAdminClient` for service-role behavior.
- Mock `fetch` for ESPN and cron trigger calls.
- Mock `recalculateAllScores` for sync and admin recalc tests.
- Call route handlers with real `Request` objects.

Tests should cover happy paths, authorization failures, membership failures, validation errors, and Supabase error propagation.

### Component And Context Tests

Add a React testing setup for components and contexts. The preferred stack is Vitest with jsdom and Testing Library. Component tests should verify user-observable behavior rather than implementation details.

The component suite should avoid snapshot-heavy tests. It should assert text, controls, disabled states, routing calls, action calls, and visible error states.

### E2E Tests

Add Playwright for full browser journeys. E2E tests should run against predictable mocked or seeded data. If local Supabase is not added in the first implementation phase, E2E tests should start with routes and flows that can be tested through controlled mocks or a minimal test harness.

Before adding Playwright, confirm the app can run in CI with the required environment variables and a stable test data strategy.

## Security Design

Security tests should make authorization requirements obvious and hard to regress:

- Service-role Supabase access must only happen after authorization succeeds.
- Admin-only actions should test anonymous, authenticated non-admin, and admin users.
- Pool data access should test member and non-member users.
- Submission lock behavior should be tested for draft save, final submit, and leaving a pool.
- Redirect handling should test absolute URLs, protocol-relative URLs, JavaScript URLs, missing values, and valid same-origin relative paths.
- Cron sync should test missing, invalid, and valid authorization headers when a secret exists.

RLS policy tests should be documented as a separate track because mocked server-action tests cannot prove database enforcement. The implementation plan should include a decision checkpoint: either add Supabase CLI/Docker and write real RLS tests now, or defer them with a clear follow-up issue.

## Tooling Changes

Expected tooling additions:

- Add jsdom and Testing Library for React component/context tests.
- Add Playwright for E2E tests.
- Add test scripts for unit, component, E2E, and full test runs.
- Optionally wire coverage reporting through the installed `@vitest/coverage-v8`.
- Consider a separate Vitest config or project setup if node and jsdom environments conflict.

Tooling should be introduced in small steps so failures are easy to diagnose.

## Implementation Phases

### Phase 1: P0 Security And Validation

- Extract pure validation helpers where useful.
- Add mocked tests for admin actions, prediction actions, pool actions, cron sync, and auth callback.
- Fix any security issues discovered while writing tests.

### Phase 2: P1 Core Domain Coverage

- Expand bracket, third-place, standings, scoring, ESPN mapping, and recalculation tests.
- Keep domain fixtures small but representative.

### Phase 3: Component And Context Coverage

- Add jsdom and Testing Library setup.
- Test prediction context, pool cards, match prediction sheet, dashboard, leaderboard, and bracket view behavior.

### Phase 4: E2E Coverage

- Add Playwright.
- Define test data and environment strategy.
- Cover the main anonymous, authenticated, pool, prediction, dashboard, and admin guard journeys.

### Phase 5: Supabase/RLS Decision

- Estimate local Supabase setup.
- If approved, add Supabase CLI/Docker setup, migration reset, seed data, and RLS tests.
- If deferred, document the missing assurance and keep mocked security tests as the current guardrail.

## Success Criteria

- `pnpm test` remains fast and reliable for unit and mocked integration tests.
- Security-sensitive server actions have tests for anonymous, unauthorized, and authorized cases.
- Prediction submission and locking behavior are covered.
- Auth redirects and cron authorization are covered.
- Core tournament logic has enough fixture coverage to catch wrong standings, bracket, and scoring outcomes.
- Component tests cover high-risk UI state transitions.
- Playwright covers the main user journeys without becoming brittle.
- Any decision to defer real Supabase/RLS tests is explicit and documented.

