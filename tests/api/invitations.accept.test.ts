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

// Mock the Supabase JS client for service role
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))

import { POST as acceptPOST } from '@/app/api/invitations/accept/route'
import { createFakeSupabase } from '@/tests/helpers/supabaseMock'
import { createClient as mockCreateClient } from '@/lib/supabase/server'
import { createClient as mockCreateServiceClient } from '@supabase/supabase-js'

describe('Invitation accept API', () => {
  beforeEach(() => {
    // Set up environment variables for tests
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  test('accepts invitation for signed-in user with matching email', async () => {
    const singleResponses: any[] = [
      { data: { id: 'inv-1', campaign_id: 'camp-1', email: 'a@ex.com', role: 'co-gm', accepted: false } },
      { data: null, error: null }, // insert response
      { data: { id: 'inv-1' }, error: null }, // update response
    ]

    const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses })
    // Ensure auth.getUser returns email
    fakeSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'a@ex.com' } }, error: null } as any)
    
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)
    ;(mockCreateServiceClient as jest.Mock).mockReturnValue(fakeSupabase)

    const req: any = { json: async () => ({ token: 't1' }) }
    const res = await acceptPOST(req as any)

    expect((res as any).status).toBe(200)
    expect((res as any).body).toEqual({ ok: true })
    
    // Verify that insert was called for campaign_members
    expect(fakeSupabase.from('campaign_members').insert).toHaveBeenCalledWith(
      expect.objectContaining({ campaign_id: 'camp-1', user_id: 'user-1', role: 'co-gm' })
    )
    
    // Verify that update was called to mark as accepted (soft delete)
    expect(fakeSupabase.from('campaign_invitations').update).toHaveBeenCalledWith(
      expect.objectContaining({ accepted: true, invited_user_id: 'user-1' })
    )
  })

  test('returns 403 when signed-in user email does not match invitation', async () => {
    const singleResponses: any[] = [
      { data: { id: 'inv-1', campaign_id: 'camp-1', email: 'a@ex.com', role: 'co-gm', accepted: false } },
    ]

    const { fakeSupabase } = createFakeSupabase({ userId: 'user-2', singleResponses })
    fakeSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-2', email: 'other@ex.com' } }, error: null } as any)
    
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)
    ;(mockCreateServiceClient as jest.Mock).mockReturnValue(fakeSupabase)

    const req: any = { json: async () => ({ token: 't1' }) }
    const res = await acceptPOST(req as any)

    expect((res as any).status).toBe(403)
  })

  test('returns 401 when not authenticated', async () => {
    const { fakeSupabase } = createFakeSupabase({ userId: null, singleResponses: [] })
    
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)
    ;(mockCreateServiceClient as jest.Mock).mockReturnValue(fakeSupabase)

    const req: any = { json: async () => ({ token: 't1' }) }
    const res = await acceptPOST(req as any)

    expect((res as any).status).toBe(401)
  })

  test('returns 410 when invitation is expired', async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 1 day ago
    const singleResponses: any[] = [
      { data: { id: 'inv-1', campaign_id: 'camp-1', email: 'a@ex.com', role: 'co-gm', accepted: false, expires_at: past } },
    ]

    const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses })
    // Ensure auth.getUser returns email
    fakeSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'a@ex.com' } }, error: null } as any)
    
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)
    ;(mockCreateServiceClient as jest.Mock).mockReturnValue(fakeSupabase)

    const req: any = { json: async () => ({ token: 't1' }) }
    const res = await acceptPOST(req as any)

    expect((res as any).status).toBe(410)
    expect((res as any).body).toEqual({ error: 'Invitation expired' })
  })
})
