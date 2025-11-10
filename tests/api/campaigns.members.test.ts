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

import { GET, POST } from '@/app/api/campaigns/[id]/members/route'
import { createClient as mockCreateClient } from '@/lib/supabase/server'
import { createFakeSupabase } from '@/tests/helpers/supabaseMock'

describe('Campaign members API', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  test('GET returns 401 when unauthenticated', async () => {
    const { fakeSupabase } = createFakeSupabase({ userId: null })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const req: any = {}
    const res = await GET(req, { params: { id: 'camp-1' } } as any)
    expect((res as any).status).toBe(401)
  })

  test('GET returns 403 when user is not a member', async () => {
    // First single() for membership check returns null -> not a member
    const singleResponses: any[] = [ { data: null } ]
    const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const req: any = {}
    const res = await GET(req, { params: { id: 'camp-1' } } as any)
    expect((res as any).status).toBe(403)
  })

  test('GET returns members list when user is a member', async () => {
    const membership = { role: 'co-gm' }
    const membersList = [
      { id: 'm1', campaign_id: 'camp-1', user_id: 'user-1', role: 'owner', users: { id: 'user-1', email: 'u1@example.com' } },
      { id: 'm2', campaign_id: 'camp-1', user_id: 'user-2', role: 'co-gm', users: { id: 'user-2', email: 'u2@example.com' } },
    ]

    // singleResponses: first for membership check, second for the chained select (thenable)
    const singleResponses: any[] = [ { data: membership }, { data: membersList, error: null } ]
    const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const req: any = {}
    const res = await GET(req, { params: { id: 'camp-1' } } as any)
    expect((res as any).status).toBe(200)
    expect((res as any).body).toHaveProperty('members')
    expect((res as any).body.members).toHaveLength(2)
  })

  test('POST adds member when requester is owner', async () => {
    const membership = { role: 'owner' }
    const targetUser = { id: 'user-2', email: 't@example.com', display_name: 'Target' }
    const existing = null
    const newMember = { id: 'm2', campaign_id: 'camp-1', user_id: 'user-2', role: 'co-gm', users: targetUser }

    // Queue responses for: membership check, user lookup, existing check, insert result
    const singleResponses: any[] = [
      { data: membership },
      { data: targetUser },
      { data: existing },
      { data: newMember }
    ]

    const { fakeSupabase, chain } = createFakeSupabase({ userId: 'user-1', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    // Simulate request body
    const req: any = { json: async () => ({ email: 't@example.com', role: 'co-gm' }) }
    const res = await POST(req, { params: { id: 'camp-1' } } as any)

    expect((res as any).status).toBe(201)
    expect((res as any).body).toHaveProperty('member')
    // Ensure insert was called
    expect(chain.insert).toHaveBeenCalled()
  })
})
