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

describe('Campaign members API - happy paths for PATCH & DELETE', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  test('PATCH updates member role when requester is owner', async () => {
    // membership check -> owner
    // targetMember fetch -> current role co-gm
    // update result -> updated member
    const membership = { role: 'owner' }
  const targetMember = { role: 'co-gm', user_id: 'user-2' }
  const updatedMember = { id: '3fa85f64-5717-4562-b3fc-2c963f66afa6', campaign_id: 'camp-1', user_id: 'user-2', role: 'viewer', users: { id: 'user-2', email: 'u2@example.com' } }

  const singleResponses: Array<SupabaseRow<unknown>> = [ { data: membership, error: null }, { data: targetMember, error: null }, { data: updatedMember, error: null } ]
  const { fakeSupabase, chain } = createFakeSupabase({ userId: 'user-1', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const req = { json: async () => ({ memberId: '3fa85f64-5717-4562-b3fc-2c963f66afa6', role: 'viewer' }) } as unknown as Parameters<typeof PATCH>[0]
    const res = await PATCH(req, { params: { id: 'camp-1' } } as unknown as Parameters<typeof PATCH>[1])

    if ((res as unknown as { status: number }).status !== 200) {
      // Log body for debugging test failures
      console.error('PATCH response body:', JSON.stringify((res as unknown as { body: unknown }).body, null, 2))
    }

  expect((res as unknown as { status: number }).status).toBe(200)
  const body = (res as unknown as { body: unknown }).body as { member?: unknown }
  expect(body).toHaveProperty('member')
    expect(chain.update).toHaveBeenCalled()
  })

  test('DELETE removes member when requester is owner', async () => {
    // membership -> owner
    // targetMember -> role co-gm
    // delete result -> { error: null }
    const membership = { role: 'owner' }
    const targetMember = { role: 'co-gm' }
  const deleteResult: SupabaseRow<unknown> = { data: null, error: null }

  const singleResponses: Array<SupabaseRow<unknown>> = [ { data: membership, error: null }, { data: targetMember, error: null }, deleteResult ]
  const { fakeSupabase, chain } = createFakeSupabase({ userId: 'user-1', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const req = { nextUrl: { searchParams: { get: () => 'm2' } } } as unknown as Parameters<typeof DELETE>[0]
    const res = await DELETE(req, { params: { id: 'camp-1' } } as unknown as Parameters<typeof DELETE>[1])

    expect((res as unknown as { status: number }).status).toBe(200)
    expect(chain.delete).toHaveBeenCalled()
  })
})
