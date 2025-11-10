// Mock next/server to avoid Request global issues in Jest environment
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: any, opts?: any) => ({ status: opts?.status ?? 200, body }),
  },
}))

// Mock the Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

import { PATCH } from '@/app/api/campaigns/[id]/route'
import { createClient as mockCreateClient } from '@/lib/supabase/server'
import { createFakeSupabase } from '@/tests/helpers/supabaseMock'

describe('PATCH /api/campaigns/:id', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  test('returns 400 for invalid body', async () => {
    const req: any = { json: async () => ({ party_level: 3 }) }
    const res = await PATCH(req, { params: { id: 'camp-1' } } as any)
    // Expect a NextResponse-like object with status 400
    expect((res as any).status).toBe(400)
  })

  test('returns 401 when unauthenticated', async () => {
    const { fakeSupabase } = createFakeSupabase({ userId: null })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const req: any = { json: async () => ({ name: 'New Name', party_level: 5 }) }
    const res = await PATCH(req, { params: { id: 'camp-1' } } as any)
    expect((res as any).status).toBe(401)
  })

  test('updates campaign when authenticated owner', async () => {
    const existingCampaign = { id: 'camp-1', gm_id: 'user-1', name: 'Old', party_level: 3 }
    const updatedCampaign = { id: 'camp-1', gm_id: 'user-1', name: 'New Name', party_level: 5 }

    const singleResponses: any[] = [{ data: existingCampaign }, { data: updatedCampaign }]
    const { fakeSupabase, chain } = createFakeSupabase({ userId: 'user-1', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const req: any = { json: async () => ({ name: 'New Name', party_level: 5 }) }
    const res = await PATCH(req, { params: { id: 'camp-1' } } as any)

    expect((res as any).status).toBe(200)
    // Ensure update was called (update then single)
    expect(chain.update).toHaveBeenCalled()
  })
})
