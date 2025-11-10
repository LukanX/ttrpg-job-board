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

import { POST } from '@/app/api/campaigns/[id]/members/route'
import { createClient as mockCreateClient } from '@/lib/supabase/server'
import { createFakeSupabase } from '@/tests/helpers/supabaseMock'

describe('Campaign members API - error cases', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  test('POST returns 403 when requester is not owner', async () => {
    // membership check returns co-gm
    const singleResponses: any[] = [ { data: { role: 'co-gm' } } ]
    const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const req: any = { json: async () => ({ email: 't@example.com', role: 'co-gm' }) }
    const res = await POST(req, { params: { id: 'camp-1' } } as any)
    expect((res as any).status).toBe(403)
  })

  test('POST returns 400 for invalid body', async () => {
    const singleResponses: any[] = [ { data: { role: 'owner' } } ]
    const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const req: any = { json: async () => ({ email: 'not-an-email', role: 'co-gm' }) }
    const res = await POST(req, { params: { id: 'camp-1' } } as any)
    expect((res as any).status).toBe(400)
  })

  test('POST returns 404 when target user not found', async () => {
    // membership -> owner, then user lookup returns null
    const singleResponses: any[] = [ { data: { role: 'owner' } }, { data: null } ]
    const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const req: any = { json: async () => ({ email: 'missing@example.com', role: 'viewer' }) }
    const res = await POST(req, { params: { id: 'camp-1' } } as any)
    expect((res as any).status).toBe(404)
  })

  test('POST returns 400 when user already a member', async () => {
    const targetUser = { id: 'user-2', email: 't@example.com' }
    const existing = { id: 'm1' }
    const singleResponses: any[] = [ { data: { role: 'owner' } }, { data: targetUser }, { data: existing } ]
    const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const req: any = { json: async () => ({ email: 't@example.com', role: 'co-gm' }) }
    const res = await POST(req, { params: { id: 'camp-1' } } as any)
    expect((res as any).status).toBe(400)
  })
})
