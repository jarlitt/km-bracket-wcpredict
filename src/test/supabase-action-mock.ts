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

export function createSupabaseActionMock(
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null,
): SupabaseMock {
  const queuedResults: unknown[] = []
  const calls: SupabaseCall[] = []

  function recordCall(table: string, method: string, args: unknown[]) {
    calls.push({ table, method, args })
  }

  function nextResult(table: string, method: string) {
    if (queuedResults.length === 0) {
      throw new Error(`No queued Supabase result for ${table}.${method}`)
    }

    return queuedResults.shift()
  }

  function resultFor(table: string, method: string, args: unknown[]) {
    recordCall(table, method, args)
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
        recordCall(table, 'select', args)
        return chain
      }),
      eq: vi.fn((...args: unknown[]) => {
        assertQueryStarted('eq')
        recordCall(table, 'eq', args)
        return chain
      }),
      in: vi.fn((...args: unknown[]) => {
        assertQueryStarted('in')
        recordCall(table, 'in', args)
        return chain
      }),
      order: vi.fn((...args: unknown[]) => {
        assertQueryStarted('order')
        recordCall(table, 'order', args)
        return chain
      }),
      maybeSingle: vi.fn(() => resultFor(table, 'maybeSingle', [])),
      single: vi.fn(() => resultFor(table, 'single', [])),
      insert: vi.fn((...args: unknown[]) => resultFor(table, 'insert', args)),
      upsert: vi.fn((...args: unknown[]) => resultFor(table, 'upsert', args)),
      delete: vi.fn(() => {
        awaitableMethod = 'delete'
        recordCall(table, 'delete', [])
        return chain
      }),
      then<TResult1 = unknown, TResult2 = never>(
        onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ): PromiseLike<TResult1 | TResult2> {
        if (!awaitableMethod) {
          throw new Error(`Cannot await ${table} before select/delete`)
        }

        return Promise.resolve(nextResult(table, awaitableMethod)).then(
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
