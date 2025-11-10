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

describe('PATCH /api/campaigns/:id - error cases', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  test('returns 403 when authenticated but not owner', async () => {
    const existingCampaign = { id: 'camp-1', gm_id: 'user-2', name: 'Old', party_level: 3 }
    const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses: [{ data: existingCampaign, error: null }] })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const req: any = { json: async () => ({ name: 'New Name', party_level: 5 }) }
    const res = await PATCH(req, { params: { id: 'camp-1' } } as any)

    expect((res as any).status).toBe(403)
  })

  test('returns 404 when campaign not found', async () => {
    const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses: [{ data: null, error: null }] })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

  const req: any = { json: async () => ({ name: 'New Name', party_level: 5 }) }
    const res = await PATCH(req, { params: { id: 'camp-xyz' } } as any)

    expect((res as any).status).toBe(404)
  })

  test('returns 500 when DB returns an error', async () => {
    const existingCampaign = { id: 'camp-1', gm_id: 'user-1', name: 'Old', party_level: 3 }
    const singleResponses: any[] = [{ data: existingCampaign, error: null }, { data: null, error: { message: 'DB failure' } }]
    const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const req: any = { json: async () => ({ name: 'New Name', party_level: 5 }) }
    const res = await PATCH(req, { params: { id: 'camp-1' } } as any)

    expect((res as any).status).toBe(500)
  })
})
