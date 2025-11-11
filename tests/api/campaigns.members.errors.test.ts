// Mock next/server to avoid Request global issues in Jest environment
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, opts?: { status?: number }) => ({ status: opts?.status ?? 200, body }),
  },
}))

// Mock the Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

import { POST } from '@/app/api/campaigns/[id]/members/route'
import { createClient as mockCreateClient } from '@/lib/supabase/server'
import { createFakeSupabase, type SupabaseRow } from '@/tests/helpers/supabaseMock'

describe('Campaign members API - error cases', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  test('POST returns 403 when requester is not owner', async () => {
    // membership check returns co-gm
  const singleResponses: Array<SupabaseRow<unknown>> = [ { data: { role: 'co-gm' }, error: null } ]
  const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses })
  ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

  const req = { json: async () => ({ email: 't@example.com', role: 'co-gm' }) } as unknown as Parameters<typeof POST>[0]
  const res = await POST(req, { params: { id: 'camp-1' } } as unknown as Parameters<typeof POST>[1])
  expect((res as unknown as { status: number }).status).toBe(403)
  })

  test('POST returns 400 for invalid body', async () => {
  const singleResponses: Array<SupabaseRow<unknown>> = [ { data: { role: 'owner' }, error: null } ]
  const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses })
  ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

  const req = { json: async () => ({ email: 'not-an-email', role: 'co-gm' }) } as unknown as Parameters<typeof POST>[0]
  const res = await POST(req, { params: { id: 'camp-1' } } as unknown as Parameters<typeof POST>[1])
  expect((res as unknown as { status: number }).status).toBe(400)
  })

  test('POST returns 404 when target user not found', async () => {
    // membership -> owner, then user lookup returns null; invitation insert follows
  const singleResponses: Array<SupabaseRow<unknown>> = [ { data: { role: 'owner' }, error: null }, { data: null, error: null }, { data: { id: 'inv-1', email: 'missing@example.com', token: 't1' }, error: null } ]
  const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses })
  ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

  const req = { json: async () => ({ email: 'missing@example.com', role: 'viewer' }) } as unknown as Parameters<typeof POST>[0]
  const res = await POST(req, { params: { id: 'camp-1' } } as unknown as Parameters<typeof POST>[1])
  expect((res as unknown as { status: number }).status).toBe(201)
  })

  test('POST returns 400 when user already a member', async () => {
    const targetUser = { id: 'user-2', email: 't@example.com' }
    const existing = { id: 'm1' }
  const singleResponses: Array<SupabaseRow<unknown>> = [ { data: { role: 'owner' }, error: null }, { data: targetUser, error: null }, { data: existing, error: null } ]
  const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses })
  ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

  const req = { json: async () => ({ email: 't@example.com', role: 'co-gm' }) } as unknown as Parameters<typeof POST>[0]
  const res = await POST(req, { params: { id: 'camp-1' } } as unknown as Parameters<typeof POST>[1])
  expect((res as unknown as { status: number }).status).toBe(400)
  })
})
