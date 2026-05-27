# P0 Security Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first merge-ready test phase for the project: security and data-integrity tests around auth redirects, cron sync, admin actions, prediction submission, pool membership, and match-prediction access.

**Architecture:** Keep the first phase mostly in Vitest so it is fast and does not require a local Supabase database. Extract small pure helpers where behavior is security-sensitive, then test server actions and route handlers with mocked Supabase clients. Defer Playwright, component tests, and real Supabase/RLS tests to later plans after this P0 layer is stable.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase, Vitest, mocked module boundaries.

---

## Scope Boundary

This plan implements Phase 1 from `docs/superpowers/specs/2026-05-26-comprehensive-test-suite-design.md`.

It does not add Playwright, Testing Library, jsdom, or local Supabase. Those are separate follow-up plans because they add new tooling and test infrastructure. This first plan gives the project immediate protection against the most damaging failures: data leaks, open redirects, unauthenticated admin reads, broken cron authorization, invalid submissions, and cross-pool access.

## Files And Responsibilities

- Create `src/lib/cron/auth.ts`: pure authorization helper for cron route bearer-token checks. It fails closed when `CRON_SECRET` is missing because the route uses a service-role admin client.
- Create `src/lib/cron/auth.test.ts`: unit tests for cron authorization behavior.
- Modify `src/app/api/cron/sync-results/route.ts`: use the cron authorization helper.
- Create `src/lib/predictions/validation.ts`: pure validation helper for final prediction submissions.
- Create `src/lib/predictions/validation.test.ts`: unit tests for submission completeness.
- Modify `src/app/actions/predictions.ts`: use the submission validation helper.
- Modify `src/app/auth/callback/route.ts`: sanitize the `next` redirect with `safeNextPath`.
- Create `src/app/auth/callback/route.test.ts`: route tests for safe callback redirects.
- Create `src/test/supabase-action-mock.ts`: focused query-builder mock used by server-action tests. It fails loudly when a test forgets to queue an expected database result.
- Create `src/app/actions/admin.test.ts`: mocked tests for admin authorization and service-role usage.
- Create `src/app/actions/predictions.test.ts`: mocked tests for authentication, membership, validation, submit locking, and Supabase errors.
- Create `src/app/actions/pools.test.ts`: mocked tests for join, copy, leave, and submitted-pool guardrails.
- Create `src/app/actions/match-predictions.test.ts`: mocked tests for member-only prediction visibility.

Before editing any Next.js route or server-action code, read the relevant local Next.js docs in `node_modules/next/dist/docs/` because this project uses Next.js 16.

## Task 1: Add Cron Authorization Helper

**Files:**
- Create: `src/lib/cron/auth.ts`
- Create: `src/lib/cron/auth.test.ts`
- Modify: `src/app/api/cron/sync-results/route.ts`

- [ ] **Step 1: Write the failing cron auth unit tests**

Create `src/lib/cron/auth.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { authorizeCronRequest } from './auth'

describe('authorizeCronRequest', () => {
  it('rejects requests when no cron secret is configured', () => {
    expect(authorizeCronRequest({ cronSecret: undefined, authHeader: null })).toEqual({
      ok: false,
      status: 500,
      error: 'Cron secret is not configured',
    })
    expect(authorizeCronRequest({ cronSecret: '', authHeader: null })).toEqual({
      ok: false,
      status: 500,
      error: 'Cron secret is not configured',
    })
  })

  it('rejects missing authorization when a cron secret exists', () => {
    expect(authorizeCronRequest({ cronSecret: 'secret', authHeader: null })).toEqual({
      ok: false,
      status: 401,
      error: 'Unauthorized',
    })
  })

  it('rejects an invalid bearer token', () => {
    expect(
      authorizeCronRequest({
        cronSecret: 'secret',
        authHeader: 'Bearer wrong',
      }),
    ).toEqual({
      ok: false,
      status: 401,
      error: 'Unauthorized',
    })
  })

  it('allows a valid bearer token', () => {
    expect(
      authorizeCronRequest({
        cronSecret: 'secret',
        authHeader: 'Bearer secret',
      }),
    ).toEqual({ ok: true })
  })
})
```

- [ ] **Step 2: Run the focused failing test**

Run: `pnpm vitest run src/lib/cron/auth.test.ts`

Expected: FAIL because `src/lib/cron/auth.ts` does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/lib/cron/auth.ts`:

```ts
interface CronAuthInput {
  cronSecret: string | undefined
  authHeader: string | null
}

type CronAuthResult =
  | { ok: true }
  | { ok: false; status: 500; error: 'Cron secret is not configured' }
  | { ok: false; status: 401; error: 'Unauthorized' }

export function authorizeCronRequest({
  cronSecret,
  authHeader,
}: CronAuthInput): CronAuthResult {
  if (!cronSecret) {
    return { ok: false, status: 500, error: 'Cron secret is not configured' }
  }
  if (authHeader === `Bearer ${cronSecret}`) return { ok: true }
  return { ok: false, status: 401, error: 'Unauthorized' }
}
```

- [ ] **Step 4: Wire the route to the helper**

In `src/app/api/cron/sync-results/route.ts`, add the import:

```ts
import { authorizeCronRequest } from '@/lib/cron/auth'
```

Replace the inline auth block:

```ts
const cronSecret = process.env.CRON_SECRET
if (cronSecret) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
```

With:

```ts
const auth = authorizeCronRequest({
  cronSecret: process.env.CRON_SECRET,
  authHeader: request.headers.get('authorization'),
})
if (!auth.ok) {
  return NextResponse.json({ error: auth.error }, { status: auth.status })
}
```

- [ ] **Step 5: Verify**

Run: `pnpm vitest run src/lib/cron/auth.test.ts`

Expected: PASS.

- [ ] **Step 6: Add route-level auth guard tests**

Create `src/app/api/cron/sync-results/route.test.ts` with tests proving missing `CRON_SECRET` and invalid authorization stop before `fetch`, `createAdminClient`, or `recalculateAllScores`, and valid authorization reaches `fetch`.

Run: `pnpm vitest run src/lib/cron/auth.test.ts src/app/api/cron/sync-results/route.test.ts`

Expected: PASS.

Do not commit unless the user has explicitly authorized commits.

## Task 2: Sanitize Auth Callback Redirects

**Files:**
- Modify: `src/app/auth/callback/route.ts`
- Create: `src/app/auth/callback/route.test.ts`

- [ ] **Step 1: Write route tests for safe redirects**

Create `src/app/auth/callback/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

const exchangeCodeForSession = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession },
  })),
}))

describe('auth callback route', () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset()
  })

  it('redirects to a safe same-origin next path after session exchange', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null })

    const response = await GET(
      new Request('https://example.com/auth/callback?code=abc&next=/pools/main/predict'),
    )

    expect(response.headers.get('location')).toBe('https://example.com/pools/main/predict')
  })

  it('rejects an absolute next URL to avoid open redirects', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null })

    const response = await GET(
      new Request(
        'https://example.com/auth/callback?code=abc&next=https%3A%2F%2Fevil.example.com',
      ),
    )

    expect(response.headers.get('location')).toBe('https://example.com/')
  })

  it('rejects a protocol-relative next URL', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null })

    const response = await GET(
      new Request('https://example.com/auth/callback?code=abc&next=//evil.example.com'),
    )

    expect(response.headers.get('location')).toBe('https://example.com/')
  })

  it('redirects to login when session exchange fails', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error('bad code') })

    const response = await GET(
      new Request('https://example.com/auth/callback?code=bad&next=/dashboard'),
    )

    expect(response.headers.get('location')).toBe('https://example.com/auth/login')
  })
})
```

- [ ] **Step 2: Run the focused failing test**

Run: `pnpm vitest run src/app/auth/callback/route.test.ts`

Expected: FAIL on absolute/protocol-relative redirect cases because the route currently uses raw `next`.

- [ ] **Step 3: Implement safe redirect handling**

In `src/app/auth/callback/route.ts`, add:

```ts
import { safeNextPath } from '@/lib/auth/safe-next'
```

Change:

```ts
const next = searchParams.get('next') ?? '/'
```

To:

```ts
const next = safeNextPath(searchParams.get('next'))
```

Keep:

```ts
return NextResponse.redirect(`${origin}${next}`)
```

- [ ] **Step 4: Verify**

Run: `pnpm vitest run src/app/auth/callback/route.test.ts src/lib/auth/safe-next.test.ts`

Expected: PASS.

Do not commit unless the user has explicitly authorized commits.

## Task 3: Add Prediction Submission Validation

**Files:**
- Create: `src/lib/predictions/validation.ts`
- Create: `src/lib/predictions/validation.test.ts`
- Modify: `src/app/actions/predictions.ts`

- [ ] **Step 1: Write validation tests**

Create `src/lib/predictions/validation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { validatePredictionSubmission } from './validation'

function completeGroupPredictions(count: number) {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      index + 1,
      { scoreA: index % 4, scoreB: (index + 1) % 4 },
    ]),
  )
}

function incompleteGroupPredictions() {
  return {
    1: { scoreA: 1, scoreB: 0 },
    2: { scoreA: 2 },
    3: { scoreB: 1 },
  }
}

function knockoutPredictions(count: number) {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => [`R32-${index + 1}`, index + 100]),
  )
}

describe('validatePredictionSubmission', () => {
  it('accepts exactly 72 complete group predictions and at least 32 knockout predictions', () => {
    expect(
      validatePredictionSubmission({
        groupPredictions: completeGroupPredictions(72),
        knockoutPredictions: knockoutPredictions(32),
      }),
    ).toEqual({ ok: true })
  })

  it('ignores incomplete group predictions when counting completion', () => {
    expect(
      validatePredictionSubmission({
        groupPredictions: incompleteGroupPredictions(),
        knockoutPredictions: knockoutPredictions(32),
      }),
    ).toEqual({
      ok: false,
      error: 'Expected 72 complete group predictions, got 1',
    })
  })

  it('rejects too few complete group predictions', () => {
    expect(
      validatePredictionSubmission({
        groupPredictions: completeGroupPredictions(71),
        knockoutPredictions: knockoutPredictions(32),
      }),
    ).toEqual({
      ok: false,
      error: 'Expected 72 complete group predictions, got 71',
    })
  })

  it('rejects too few knockout predictions', () => {
    expect(
      validatePredictionSubmission({
        groupPredictions: completeGroupPredictions(72),
        knockoutPredictions: knockoutPredictions(31),
      }),
    ).toEqual({
      ok: false,
      error: 'Expected at least 32 knockout predictions, got 31',
    })
  })
})
```

- [ ] **Step 2: Run the focused failing test**

Run: `pnpm vitest run src/lib/predictions/validation.test.ts`

Expected: FAIL because `src/lib/predictions/validation.ts` does not exist.

- [ ] **Step 3: Implement the validation helper**

Create `src/lib/predictions/validation.ts`:

```ts
export interface GroupPredictionInput {
  scoreA?: number
  scoreB?: number
}

interface PredictionSubmissionInput {
  groupPredictions: Record<number, GroupPredictionInput>
  knockoutPredictions: Record<string, number>
}

type PredictionSubmissionValidation =
  | { ok: true }
  | { ok: false; error: string }

export function getCompleteGroupPredictionCount(
  groupPredictions: Record<number, GroupPredictionInput>,
): number {
  return Object.values(groupPredictions).filter(
    (value) => typeof value.scoreA === 'number' && typeof value.scoreB === 'number',
  ).length
}

export function validatePredictionSubmission({
  groupPredictions,
  knockoutPredictions,
}: PredictionSubmissionInput): PredictionSubmissionValidation {
  const completeGroupCount = getCompleteGroupPredictionCount(groupPredictions)
  if (completeGroupCount !== 72) {
    return {
      ok: false,
      error: `Expected 72 complete group predictions, got ${completeGroupCount}`,
    }
  }

  const knockoutCount = Object.keys(knockoutPredictions).length
  if (knockoutCount < 32) {
    return {
      ok: false,
      error: `Expected at least 32 knockout predictions, got ${knockoutCount}`,
    }
  }

  return { ok: true }
}
```

- [ ] **Step 4: Wire validation into submit action**

In `src/app/actions/predictions.ts`, import:

```ts
import { validatePredictionSubmission } from '@/lib/predictions/validation'
```

After the existing submitted-pool check and before building `groupRows`, add:

```ts
const validation = validatePredictionSubmission({
  groupPredictions,
  knockoutPredictions,
})
if (!validation.ok) {
  return { success: false, error: validation.error }
}
```

Then remove the old inline group-count and knockout-count rejection blocks. Keep the `groupRows` and `knockoutRows` construction for database writes.

- [ ] **Step 5: Verify**

Run: `pnpm vitest run src/lib/predictions/validation.test.ts`

Expected: PASS.

Run: `pnpm test`

Expected: PASS.

Do not commit unless the user has explicitly authorized commits.

## Task 4: Add A Focused Supabase Action Mock

**Files:**
- Create: `src/test/supabase-action-mock.ts`

- [ ] **Step 1: Create a query-builder mock helper**

Create `src/test/supabase-action-mock.ts`:

```ts
import { vi } from 'vitest'

export interface SupabaseCall {
  table: string
  method: string
  args: unknown[]
}

export interface SupabaseMock {
  client: {
    auth: { getUser: ReturnType<typeof vi.fn> }
    from: ReturnType<typeof vi.fn>
  }
  calls: SupabaseCall[]
  queueResult: (result: unknown) => void
}

export function createSupabaseActionMock(user: { id: string } | null): SupabaseMock {
  const queuedResults: unknown[] = []
  const calls: SupabaseCall[] = []

  function nextResult(table: string, method: string) {
    const result = queuedResults.shift()
    if (!result) {
      throw new Error(`No queued Supabase result for ${table}.${method}`)
    }
    return result
  }

  function resultFor(table: string, method: string, args: unknown[]) {
    calls.push({ table, method, args })
    return nextResult(table, method)
  }

  function builder(table: string) {
    let awaitableMethod: string | null = null

    function assertQueryStarted(method: string) {
      if (!awaitableMethod) {
        throw new Error(`Cannot call ${method} on ${table} before select/delete`)
      }
    }

    const chain = {
      select: vi.fn((...args: unknown[]) => {
        awaitableMethod = 'select'
        calls.push({ table, method: 'select', args })
        return chain
      }),
      eq: vi.fn((...args: unknown[]) => {
        assertQueryStarted('eq')
        calls.push({ table, method: 'eq', args })
        return chain
      }),
      in: vi.fn((...args: unknown[]) => {
        assertQueryStarted('in')
        calls.push({ table, method: 'in', args })
        return chain
      }),
      order: vi.fn((...args: unknown[]) => {
        assertQueryStarted('order')
        calls.push({ table, method: 'order', args })
        return chain
      }),
      maybeSingle: vi.fn(() => resultFor(table, 'maybeSingle', [])),
      single: vi.fn(() => resultFor(table, 'single', [])),
      insert: vi.fn((...args: unknown[]) => resultFor(table, 'insert', args)),
      upsert: vi.fn((...args: unknown[]) => resultFor(table, 'upsert', args)),
      delete: vi.fn(() => {
        awaitableMethod = 'delete'
        calls.push({ table, method: 'delete', args: [] })
        return chain
      }),
      then<TResult1 = unknown, TResult2 = never>(
        onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ): PromiseLike<TResult1 | TResult2> {
        return Promise.resolve(nextResult(table, awaitableMethod ?? 'then')).then(
          onfulfilled,
          onrejected,
        )
      },
    }

    return chain
  }

  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user } })),
    },
    from: vi.fn((table: string) => builder(table)),
  }

  return {
    client,
    calls,
    queueResult(result: unknown) {
      queuedResults.push(result)
    },
  }
}
```

- [ ] **Step 2: Run typecheck through the test command**

Run: `pnpm vitest run --passWithNoTests src/test/supabase-action-mock.ts`

Expected: PASS or "No test files found" depending on Vitest matching behavior. If Vitest rejects the path, run `pnpm test` after the first test file imports this helper. The helper should throw when a test forgets to queue an expected result instead of silently returning empty data.

Do not commit unless the user has explicitly authorized commits.

## Task 5: Test Admin Action Security

**Files:**
- Create: `src/app/actions/admin.test.ts`
- Modify: `src/app/actions/admin.ts`

- [ ] **Step 1: Write failing admin tests**

Create `src/app/actions/admin.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseActionMock } from '@/test/supabase-action-mock'

const createClient = vi.fn()
const createAdminClient = vi.fn()
const recalculateAllScores = vi.fn()

vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))
vi.mock('@/lib/scoring/recalculate', () => ({ recalculateAllScores }))

describe('admin actions', () => {
  beforeEach(() => {
    vi.resetModules()
    createClient.mockReset()
    createAdminClient.mockReset()
    recalculateAllScores.mockReset()
  })

  it('blocks group result writes for anonymous users before creating an admin client', async () => {
    const userClient = createSupabaseActionMock(null)
    createClient.mockResolvedValue(userClient.client)

    const { saveGroupResult } = await import('./admin')
    const result = await saveGroupResult(1, 2, 1)

    expect(result).toEqual({ success: false, error: 'Not authenticated' })
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('blocks group result writes for non-admin users before creating an admin client', async () => {
    const userClient = createSupabaseActionMock({ id: 'user-1' })
    userClient.queueResult({ data: { is_admin: false }, error: null })
    createClient.mockResolvedValue(userClient.client)

    const { saveGroupResult } = await import('./admin')
    const result = await saveGroupResult(1, 2, 1)

    expect(result).toEqual({ success: false, error: 'Not an admin' })
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('allows admins to save group results through the admin client', async () => {
    const userClient = createSupabaseActionMock({ id: 'admin-1' })
    userClient.queueResult({ data: { is_admin: true }, error: null })
    createClient.mockResolvedValue(userClient.client)

    const adminClient = createSupabaseActionMock({ id: 'admin-1' })
    adminClient.queueResult({ data: null, error: null })
    createAdminClient.mockReturnValue(adminClient.client)

    const { saveGroupResult } = await import('./admin')
    const result = await saveGroupResult(1, 2, 1)

    expect(result).toEqual({ success: true })
    expect(createAdminClient).toHaveBeenCalledOnce()
    expect(adminClient.calls.some((call) => call.table === 'actual_group_results')).toBe(true)
  })

  it('requires admin access before returning admin stats', async () => {
    const userClient = createSupabaseActionMock(null)
    createClient.mockResolvedValue(userClient.client)

    const { getAdminStats } = await import('./admin')

    await expect(getAdminStats()).rejects.toThrow('Not authenticated')
    expect(createAdminClient).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the focused failing test**

Run: `pnpm vitest run src/app/actions/admin.test.ts`

Expected: FAIL on `getAdminStats` because it currently creates a service-role client without calling the admin guard.

- [ ] **Step 3: Fix `getAdminStats`**

In `src/app/actions/admin.ts`, add this as the first statement inside `getAdminStats`:

```ts
await requireAdmin()
```

So the function starts:

```ts
export async function getAdminStats(): Promise<{
  totalUsers: number
  totalSubmissions: number
  groupResultsEntered: number
  knockoutResultsEntered: number
  pools: Array<{ id: string; name: string; slug: string; members: number; submissions: number }>
}> {
  await requireAdmin()
  const supabase = createAdminClient()
```

- [ ] **Step 4: Verify**

Run: `pnpm vitest run src/app/actions/admin.test.ts`

Expected: PASS.

Do not commit unless the user has explicitly authorized commits.

## Task 6: Test Prediction Action Guardrails

**Files:**
- Create: `src/app/actions/predictions.test.ts`

- [ ] **Step 1: Write tests for authentication, membership, and final submission validation**

Create `src/app/actions/predictions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseActionMock } from '@/test/supabase-action-mock'

const createClient = vi.fn()

vi.mock('@/lib/supabase/server', () => ({ createClient }))

function completeGroupPredictions(count: number) {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      index + 1,
      { scoreA: index % 4, scoreB: (index + 1) % 4 },
    ]),
  )
}

function knockoutPredictions(count: number) {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => [`R32-${index + 1}`, index + 100]),
  )
}

describe('prediction actions', () => {
  beforeEach(() => {
    vi.resetModules()
    createClient.mockReset()
  })

  it('returns null when loading predictions anonymously', async () => {
    const supabase = createSupabaseActionMock(null)
    createClient.mockResolvedValue(supabase.client)

    const { loadPredictions } = await import('./predictions')

    await expect(loadPredictions('pool-1')).resolves.toBeNull()
  })

  it('blocks draft saves for non-members', async () => {
    const supabase = createSupabaseActionMock({ id: 'user-1' })
    supabase.queueResult({ data: null, error: null })
    createClient.mockResolvedValue(supabase.client)

    const { savePredictionDraft } = await import('./predictions')
    const result = await savePredictionDraft('pool-1', {}, {})

    expect(result).toEqual({
      success: false,
      error: 'You are not a member of this pool',
    })
  })

  it('blocks draft saves after a pool has been submitted', async () => {
    const supabase = createSupabaseActionMock({ id: 'user-1' })
    supabase.queueResult({ data: { pool_id: 'pool-1' }, error: null })
    supabase.queueResult({ data: { user_id: 'user-1' }, error: null })
    createClient.mockResolvedValue(supabase.client)

    const { savePredictionDraft } = await import('./predictions')
    const result = await savePredictionDraft('pool-1', { 1: { scoreA: 1, scoreB: 0 } }, {})

    expect(result).toEqual({ success: false, error: 'Pool already submitted' })
  })

  it('rejects incomplete final submissions before writing predictions', async () => {
    const supabase = createSupabaseActionMock({ id: 'user-1' })
    supabase.queueResult({ data: { pool_id: 'pool-1' }, error: null })
    supabase.queueResult({ data: null, error: null })
    createClient.mockResolvedValue(supabase.client)

    const { submitPredictionsToDb } = await import('./predictions')
    const result = await submitPredictionsToDb(
      'pool-1',
      completeGroupPredictions(71),
      knockoutPredictions(32),
    )

    expect(result).toEqual({
      success: false,
      error: 'Expected 72 complete group predictions, got 71',
    })
    expect(supabase.calls.some((call) => call.method === 'upsert')).toBe(false)
  })

  it('writes predictions and records a lock for complete final submissions', async () => {
    const supabase = createSupabaseActionMock({ id: 'user-1' })
    supabase.queueResult({ data: { pool_id: 'pool-1' }, error: null })
    supabase.queueResult({ data: null, error: null })
    supabase.queueResult({ data: null, error: null })
    supabase.queueResult({ data: null, error: null })
    supabase.queueResult({ data: null, error: null })
    createClient.mockResolvedValue(supabase.client)

    const { submitPredictionsToDb } = await import('./predictions')
    const result = await submitPredictionsToDb(
      'pool-1',
      completeGroupPredictions(72),
      knockoutPredictions(32),
    )

    expect(result).toEqual({ success: true })
    expect(supabase.calls.some((call) => call.table === 'group_predictions')).toBe(true)
    expect(supabase.calls.some((call) => call.table === 'knockout_predictions')).toBe(true)
    expect(supabase.calls.some((call) => call.table === 'submissions')).toBe(true)
  })
})
```

- [ ] **Step 2: Run the focused tests**

Run: `pnpm vitest run src/app/actions/predictions.test.ts src/lib/predictions/validation.test.ts`

Expected: PASS after Tasks 3 and 4 are complete. If a test fails because the query mock is too simple for a chained call, extend `src/test/supabase-action-mock.ts` with the missing chain method and rerun.

Do not commit unless the user has explicitly authorized commits.

## Task 7: Test Pool Action Guardrails

**Files:**
- Create: `src/app/actions/pools.test.ts`

- [ ] **Step 1: Write tests for join, copy, and leave security behavior**

Create `src/app/actions/pools.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseActionMock } from '@/test/supabase-action-mock'

const createClient = vi.fn()

vi.mock('@/lib/supabase/server', () => ({ createClient }))

describe('pool actions', () => {
  beforeEach(() => {
    vi.resetModules()
    createClient.mockReset()
  })

  it('requires authentication to join a pool', async () => {
    const supabase = createSupabaseActionMock(null)
    createClient.mockResolvedValue(supabase.client)

    const { joinPool } = await import('./pools')
    const result = await joinPool('pool-1')

    expect(result).toEqual({ success: false, error: 'Not authenticated' })
  })

  it('rejects inactive or missing pools before inserting membership', async () => {
    const supabase = createSupabaseActionMock({ id: 'user-1' })
    supabase.queueResult({ data: { id: 'pool-1', is_active: false }, error: null })
    createClient.mockResolvedValue(supabase.client)

    const { joinPool } = await import('./pools')
    const result = await joinPool('pool-1')

    expect(result).toEqual({ success: false, error: 'Pool not found or inactive' })
    expect(supabase.calls.some((call) => call.method === 'insert')).toBe(false)
  })

  it('rejects duplicate joins', async () => {
    const supabase = createSupabaseActionMock({ id: 'user-1' })
    supabase.queueResult({ data: { id: 'pool-1', is_active: true }, error: null })
    supabase.queueResult({ data: { pool_id: 'pool-1' }, error: null })
    createClient.mockResolvedValue(supabase.client)

    const { joinPool } = await import('./pools')
    const result = await joinPool('pool-1')

    expect(result).toEqual({ success: false, error: 'Already a member of this pool' })
  })

  it('rejects copying predictions from the destination pool itself', async () => {
    const supabase = createSupabaseActionMock({ id: 'user-1' })
    createClient.mockResolvedValue(supabase.client)

    const { joinPool } = await import('./pools')
    const result = await joinPool('pool-1', { copyFromPoolId: 'pool-1' })

    expect(result).toEqual({ success: false, error: 'Cannot copy from the same pool' })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('blocks leaving a pool after submission', async () => {
    const supabase = createSupabaseActionMock({ id: 'user-1' })
    supabase.queueResult({ data: { user_id: 'user-1' }, error: null })
    createClient.mockResolvedValue(supabase.client)

    const { leavePool } = await import('./pools')
    const result = await leavePool('pool-1')

    expect(result).toEqual({
      success: false,
      error: 'Cannot leave a pool after submitting',
    })
    expect(supabase.calls.some((call) => call.method === 'delete')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the focused tests**

Run: `pnpm vitest run src/app/actions/pools.test.ts src/lib/pools/copy-validation.test.ts`

Expected: PASS. If a mock chain method is missing, extend `src/test/supabase-action-mock.ts` with that method and rerun.

Do not commit unless the user has explicitly authorized commits.

## Task 8: Test Match Prediction Access

**Files:**
- Create: `src/app/actions/match-predictions.test.ts`

- [ ] **Step 1: Write member-only access tests**

Create `src/app/actions/match-predictions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseActionMock } from '@/test/supabase-action-mock'

const createClient = vi.fn()

vi.mock('@/lib/supabase/server', () => ({ createClient }))

describe('match prediction actions', () => {
  beforeEach(() => {
    vi.resetModules()
    createClient.mockReset()
  })

  it('returns null for anonymous users', async () => {
    const supabase = createSupabaseActionMock(null)
    createClient.mockResolvedValue(supabase.client)

    const { getMatchPredictions } = await import('./match-predictions')

    await expect(getMatchPredictions('group', 1, 'pool-1')).resolves.toBeNull()
  })

  it('returns null for authenticated non-members', async () => {
    const supabase = createSupabaseActionMock({ id: 'user-1' })
    supabase.queueResult({ data: null, error: null })
    createClient.mockResolvedValue(supabase.client)

    const { getMatchPredictions } = await import('./match-predictions')

    await expect(getMatchPredictions('group', 1, 'pool-1')).resolves.toBeNull()
  })

  it('does not read prediction rows for non-members', async () => {
    const supabase = createSupabaseActionMock({ id: 'user-1' })
    supabase.queueResult({ data: null, error: null })
    createClient.mockResolvedValue(supabase.client)

    const { getMatchPredictions } = await import('./match-predictions')
    await getMatchPredictions('knockout', 'R32-1', 'pool-1')

    expect(supabase.calls.some((call) => call.table === 'group_predictions')).toBe(false)
    expect(supabase.calls.some((call) => call.table === 'knockout_predictions')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the focused tests**

Run: `pnpm vitest run src/app/actions/match-predictions.test.ts`

Expected: PASS. These tests protect the member-only privacy boundary.

Do not commit unless the user has explicitly authorized commits.

## Task 9: Run Full Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 2: Run lint**

Run: `pnpm lint`

Expected: PASS or only pre-existing warnings unrelated to this plan. Fix any lint issues introduced by this work.

- [ ] **Step 3: Review changed files**

Run: `git status --short`

Expected: shows the new tests, new helpers, and the small route/action changes from this plan.

Run: `git diff -- src/lib/cron/auth.ts src/lib/cron/auth.test.ts src/app/api/cron/sync-results/route.ts src/app/auth/callback/route.ts src/app/auth/callback/route.test.ts src/lib/predictions/validation.ts src/lib/predictions/validation.test.ts src/test/supabase-action-mock.ts src/app/actions/admin.ts src/app/actions/admin.test.ts src/app/actions/predictions.ts src/app/actions/predictions.test.ts src/app/actions/pools.test.ts src/app/actions/match-predictions.test.ts`

Expected: diff only contains the P0 test-suite work.

Do not commit unless the user has explicitly authorized commits.

## Self-Review Notes

Spec coverage:

- P0 admin gating is covered by Task 5.
- P0 cron secret behavior is covered by Task 1, including fail-closed behavior when `CRON_SECRET` is missing.
- P0 auth callback redirect sanitization is covered by Task 2.
- P0 prediction submission completeness and locking are covered by Tasks 3 and 6.
- P0 pool membership and copy guardrails are covered by Tasks 7 and 8.
- Supabase/RLS, Playwright, component tests, and broader domain coverage are intentionally outside this first plan and should be planned after this security layer lands.

No placeholders remain in this plan. The local Supabase decision is explicitly deferred by scope, not left ambiguous.

