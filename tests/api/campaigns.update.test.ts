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

import { PATCH } from '@/app/api/campaigns/[id]/route'
import { createClient as mockCreateClient } from '@/lib/supabase/server'
import { createFakeSupabase, type SupabaseRow } from '@/tests/helpers/supabaseMock'

describe('PATCH /api/campaigns/:id', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  test('returns 400 for invalid body', async () => {
    const req = { json: async () => ({ party_level: 3 }) } as unknown as Parameters<typeof PATCH>[0]
    const res = await PATCH(req, { params: { id: 'camp-1' } } as unknown as Parameters<typeof PATCH>[1])
    // Expect a NextResponse-like object with status 400
    expect((res as unknown as { status: number }).status).toBe(400)
  })

  test('returns 401 when unauthenticated', async () => {
    const { fakeSupabase } = createFakeSupabase({ userId: null })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const req = { json: async () => ({ name: 'New Name', party_level: 5 }) } as unknown as Parameters<typeof PATCH>[0]
    const res = await PATCH(req, { params: { id: 'camp-1' } } as unknown as Parameters<typeof PATCH>[1])
    expect((res as unknown as { status: number }).status).toBe(401)
  })

  test('updates campaign when authenticated owner', async () => {
    const existingCampaign = { id: 'camp-1', gm_id: 'user-1', name: 'Old', party_level: 3 }
    const updatedCampaign = { id: 'camp-1', gm_id: 'user-1', name: 'New Name', party_level: 5 }
    const membershipData = { campaign_id: 'camp-1', user_id: 'user-1', role: 'owner' }

    // Need 3 single() responses: 1 for membership check, 1 for campaign fetch, 1 for update result
    const singleResponses: Array<SupabaseRow<unknown>> = [
      { data: membershipData, error: null },  // First: membership check
      { data: existingCampaign, error: null }, // Second: campaign fetch (for validation)
      { data: updatedCampaign, error: null }   // Third: update result
    ]
    const { fakeSupabase, chain } = createFakeSupabase({ userId: 'user-1', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

  const req = { json: async () => ({ name: 'New Name', party_level: 5 }) } as unknown as Parameters<typeof PATCH>[0]
  const res = await PATCH(req, { params: { id: 'camp-1' } } as unknown as Parameters<typeof PATCH>[1])

  expect((res as unknown as { status: number }).status).toBe(200)
    // Ensure update was called (update then single)
    expect(chain.update).toHaveBeenCalled()
  })
})
