import { createChain, createFakeSupabase, type SupabaseRow } from '@/tests/helpers/supabaseMock'

describe('supabaseMock helpers', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  test('createChain returns a chain whose single() yields provided responses in order', async () => {
    const responses: Array<SupabaseRow<any>> = [
      { data: { id: 'one' }, error: null },
      { data: { id: 'two' }, error: null },
    ]

    const chain = createChain(responses.slice())

    const first = await chain.single()
    const second = await chain.single()

    expect(first).toEqual({ data: { id: 'one' }, error: null })
    expect(second).toEqual({ data: { id: 'two' }, error: null })
    // subsequent calls resolve to undefined -> Promise.resolve(undefined)
    const third = await chain.single()
    expect(third).toBeUndefined()
  })

  test('createFakeSupabase returns client with auth.getUser and from()', async () => {
    const { fakeSupabase, chain } = createFakeSupabase({ userId: 'user-1', singleResponses: [{ data: { id: 'x' }, error: null }] })

    const userRes = await fakeSupabase.auth.getUser()
    expect(userRes.data?.user?.id).toBe('user-1')

    const fromChain = fakeSupabase.from('campaigns')
    expect(fromChain).toBe(chain)

    const r = await fromChain.single()
    expect(r).toEqual({ data: { id: 'x' }, error: null })
  })
})
