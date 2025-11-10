// Shared helpers to create fake Supabase clients and query chains for tests

export type SupabaseRow<T = any> = { data: T | null; error: any | null }

export type SupabaseChain<T = any> = {
  select: jest.MockedFunction<() => any>
  eq: jest.MockedFunction<() => any>
  order: jest.MockedFunction<() => any>
  update: jest.MockedFunction<() => any>
  insert: jest.MockedFunction<() => any>
  delete: jest.MockedFunction<() => any>
  single: jest.Mock<Promise<SupabaseRow<T>>, []>
}

export function createChain<T = any>(singleResponses: Array<SupabaseRow<T>> = []): SupabaseChain<T> {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    single: jest.fn().mockImplementation(() => Promise.resolve(singleResponses.shift())),
    // Make the chain thenable so awaiting the chain (without calling .single())
    // will resolve to the next queued response. This mimics Supabase's
    // behavior where chained queries return a promise with { data, error }.
    then: jest.fn().mockImplementation((resolve: any, reject: any) =>
      Promise.resolve(singleResponses.shift()).then(resolve, reject)
    ),
  }

  return chain as SupabaseChain<T>
}

export type FakeSupabase<T = any> = {
  auth: { getUser: jest.Mock<Promise<{ data: { user: { id: string } } | null; error: any }>, []> }
  from: jest.MockedFunction<(table: string) => SupabaseChain<T>>
}

export function createFakeSupabase<T = any>({ userId = null, singleResponses = [] }: { userId?: string | null; singleResponses?: Array<SupabaseRow<T>> } = {}) {
  const chain = createChain<T>(singleResponses)

  const fakeSupabase: FakeSupabase<T> = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null }, error: null }) },
    from: jest.fn().mockReturnValue(chain),
  }

  return { fakeSupabase, chain }
}
