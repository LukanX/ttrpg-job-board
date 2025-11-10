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

import { PATCH, DELETE } from '@/app/api/campaigns/[id]/members/route'
import { createClient as mockCreateClient } from '@/lib/supabase/server'
import { createFakeSupabase } from '@/tests/helpers/supabaseMock'

describe('Campaign members API - patch & delete error cases', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  test('PATCH returns 403 when requester is not owner', async () => {
    const singleResponses: any[] = [ { data: { role: 'co-gm' } } ]
    const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const req: any = { json: async () => ({ memberId: 'm1', role: 'viewer' }) }
    const res = await PATCH(req, { params: { id: 'camp-1' } } as any)
    expect((res as any).status).toBe(403)
  })

  test('PATCH returns 400 when trying to change owner role', async () => {
    // requester is owner, targetMember.role === 'owner'
    const singleResponses: any[] = [ { data: { role: 'owner' } }, { data: { role: 'owner', user_id: 'user-1' } } ]
    const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const req: any = { json: async () => ({ memberId: 'm-owner', role: 'viewer' }) }
    const res = await PATCH(req, { params: { id: 'camp-1' } } as any)
    expect((res as any).status).toBe(400)
  })

  test('DELETE returns 400 when memberId missing', async () => {
    const singleResponses: any[] = [ { data: { role: 'owner' } } ]
    const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const req: any = { nextUrl: { searchParams: { get: () => null } } }
    const res = await DELETE(req, { params: { id: 'camp-1' } } as any)
    expect((res as any).status).toBe(400)
  })

  test('DELETE returns 400 when trying to remove owner', async () => {
    // requester owner, targetMember.role === 'owner'
    const singleResponses: any[] = [ { data: { role: 'owner' } }, { data: { role: 'owner' } } ]
    const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const req: any = { nextUrl: { searchParams: { get: () => 'm-owner' } } }
    const res = await DELETE(req, { params: { id: 'camp-1' } } as any)
    expect((res as any).status).toBe(400)
  })
})
