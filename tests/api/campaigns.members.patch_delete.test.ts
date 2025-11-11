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

import { PATCH, DELETE } from '@/app/api/campaigns/[id]/members/route'
import { createClient as mockCreateClient } from '@/lib/supabase/server'
import { createFakeSupabase, type SupabaseRow } from '@/tests/helpers/supabaseMock'

describe('Campaign members API - patch & delete error cases', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  test('PATCH returns 403 when requester is not owner', async () => {
  const singleResponses: Array<SupabaseRow<unknown>> = [ { data: { role: 'co-gm' }, error: null } ]
  const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses })
  ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

  const req = { json: async () => ({ memberId: 'm1', role: 'viewer' }) } as unknown as Parameters<typeof PATCH>[0]
  const res = await PATCH(req, { params: { id: 'camp-1' } } as unknown as Parameters<typeof PATCH>[1])
  expect((res as unknown as { status: number }).status).toBe(403)
  })

  test('PATCH returns 400 when trying to change owner role', async () => {
    // requester is owner, targetMember.role === 'owner'
  const singleResponses: Array<SupabaseRow<unknown>> = [ { data: { role: 'owner' }, error: null }, { data: { role: 'owner', user_id: 'user-1' }, error: null } ]
  const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses })
  ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

  const req = { json: async () => ({ memberId: 'm-owner', role: 'viewer' }) } as unknown as Parameters<typeof PATCH>[0]
  const res = await PATCH(req, { params: { id: 'camp-1' } } as unknown as Parameters<typeof PATCH>[1])
  expect((res as unknown as { status: number }).status).toBe(400)
  })

  test('DELETE returns 400 when memberId missing', async () => {
  const singleResponses: Array<SupabaseRow<unknown>> = [ { data: { role: 'owner' }, error: null } ]
  const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses })
  ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

  const req = { nextUrl: { searchParams: { get: () => null } } } as unknown as Parameters<typeof DELETE>[0]
  const res = await DELETE(req, { params: { id: 'camp-1' } } as unknown as Parameters<typeof DELETE>[1])
  expect((res as unknown as { status: number }).status).toBe(400)
  })

  test('DELETE returns 400 when trying to remove owner', async () => {
    // requester owner, targetMember.role === 'owner'
  const singleResponses: Array<SupabaseRow<unknown>> = [ { data: { role: 'owner' }, error: null }, { data: { role: 'owner' }, error: null } ]
  const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses })
  ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

  const req = { nextUrl: { searchParams: { get: () => 'm-owner' } } } as unknown as Parameters<typeof DELETE>[0]
  const res = await DELETE(req, { params: { id: 'camp-1' } } as unknown as Parameters<typeof DELETE>[1])
  expect((res as unknown as { status: number }).status).toBe(400)
  })
})
