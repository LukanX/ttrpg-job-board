// Shared helpers to create fake Supabase clients and query chains for tests
export function createChain(singleResponses: any[] = []) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    single: jest.fn().mockImplementation(() => Promise.resolve(singleResponses.shift())),
  }
}

export function createFakeSupabase({ userId = null, singleResponses = [] }: { userId?: string | null; singleResponses?: any[] } = {}) {
  const chain = createChain(singleResponses)

  const fakeSupabase: any = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null }, error: null }) },
    from: jest.fn().mockReturnValue(chain),
  }

  return { fakeSupabase, chain }
}
