// Shared helpers to create fake Supabase clients and query chains for tests

export type SupabaseRow<T = unknown> = { data: T | null; error: unknown | null }

export type SupabaseChain<T = unknown> = {
  select: jest.MockedFunction<() => SupabaseChain<T>>
  eq: jest.MockedFunction<() => SupabaseChain<T>>
  order: jest.MockedFunction<() => SupabaseChain<T>>
  update: jest.MockedFunction<() => SupabaseChain<T>>
  insert: jest.MockedFunction<() => SupabaseChain<T>>
  delete: jest.MockedFunction<() => SupabaseChain<T>>
  single: jest.Mock<Promise<SupabaseRow<T>>, []>
}

export function createChain<T = unknown>(singleResponses: Array<SupabaseRow<T>> = []): SupabaseChain<T> {
  const chainPartial: Partial<SupabaseChain<T>> = {
    select: jest.fn().mockReturnThis() as unknown as jest.MockedFunction<() => SupabaseChain<T>>,
    eq: jest.fn().mockReturnThis() as unknown as jest.MockedFunction<() => SupabaseChain<T>>,
    order: jest.fn().mockReturnThis() as unknown as jest.MockedFunction<() => SupabaseChain<T>>,
    update: jest.fn().mockReturnThis() as unknown as jest.MockedFunction<() => SupabaseChain<T>>,
    insert: jest.fn().mockReturnThis() as unknown as jest.MockedFunction<() => SupabaseChain<T>>,
    delete: jest.fn().mockReturnThis() as unknown as jest.MockedFunction<() => SupabaseChain<T>>,
    single: jest.fn().mockImplementation(() => Promise.resolve(singleResponses.shift())) as unknown as jest.Mock<Promise<SupabaseRow<T>>, []>,
  }

  // Add a thenable shape so tests can `await chain` directly (mimic Supabase)
  ;(chainPartial as unknown as { then?: (...args: unknown[]) => unknown }).then = jest.fn().mockImplementation(
    (resolve: (value: unknown) => void, reject: (reason?: unknown) => void) =>
      Promise.resolve(singleResponses.shift()).then(
        resolve as unknown as (value: unknown) => unknown,
        reject as unknown as (reason?: unknown) => unknown
      )
  )

  return chainPartial as SupabaseChain<T>
}

export type FakeSupabase<T = unknown> = {
  auth: { getUser: jest.Mock<Promise<{ data: { user: { id: string } } | null; error: unknown }>, []> }
  from: jest.MockedFunction<(table: string) => SupabaseChain<T>>
}

export function createFakeSupabase<T = unknown>({ userId = null, singleResponses = [] }: { userId?: string | null; singleResponses?: Array<SupabaseRow<T>> } = {}) {
  const chain = createChain<T>(singleResponses)

  const fakeSupabase: FakeSupabase<T> = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null }, error: null }) },
    from: jest.fn().mockReturnValue(chain) as unknown as jest.MockedFunction<(table: string) => SupabaseChain<T>>,
  }

  return { fakeSupabase, chain }
}
