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

import { POST, PATCH, DELETE } from '@/app/api/campaigns/[id]/organizations/route'
import { createClient as mockCreateClient } from '@/lib/supabase/server'
import { createFakeSupabase } from '@/tests/helpers/supabaseMock'

describe('Campaign organizations API (POST/PATCH/DELETE)', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  test('POST creates organization when requester is owner', async () => {
    const membership = { role: 'owner' }
    const created = { id: 'org-1', campaign_id: 'camp-1', name: 'Acme', description: 'desc', faction_type: 'Corp' }

    const singleResponses: any[] = [ { data: membership }, { data: created } ]
    const { fakeSupabase, chain } = createFakeSupabase({ userId: 'user-1', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const req: any = { json: async () => ({ name: 'Acme', description: 'desc', faction_type: 'Corp' }) }
    const res = await POST(req as any, { params: { id: 'camp-1' } } as any)

    expect((res as any).status).toBe(201)
    expect((res as any).body).toHaveProperty('organization')
    expect(chain.insert).toHaveBeenCalled()
  })

  test('POST returns 403 when requester is not owner/co-gm', async () => {
    const membership = { role: 'viewer' }
    const singleResponses: any[] = [ { data: membership } ]
    const { fakeSupabase } = createFakeSupabase({ userId: 'user-2', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const req: any = { json: async () => ({ name: 'Acme' }) }
    const res = await POST(req as any, { params: { id: 'camp-1' } } as any)

    expect((res as any).status).toBe(403)
  })

  test('PATCH updates organization when requester is owner', async () => {
    const membership = { role: 'owner' }
    const updated = { id: 'org-1', campaign_id: 'camp-1', name: 'Acme X', description: 'new', faction_type: 'Corp' }

    const singleResponses: any[] = [ { data: membership }, { data: updated } ]
    const { fakeSupabase, chain } = createFakeSupabase({ userId: 'user-1', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

  const req: any = { json: async () => ({ orgId: '3fa85f64-5717-4562-b3fc-2c963f66afa6', name: 'Acme X', description: 'new', faction_type: 'Corp' }) }
    const res = await PATCH(req as any, { params: { id: 'camp-1' } } as any)

    expect((res as any).status).toBe(200)
    expect((res as any).body).toHaveProperty('organization')
    expect(chain.update).toHaveBeenCalled()
  })

  test('PATCH returns 403 when requester is not owner', async () => {
    const membership = { role: 'co-gm' } // only owner allowed for PATCH in current implementation
    const singleResponses: any[] = [ { data: membership } ]
    const { fakeSupabase } = createFakeSupabase({ userId: 'user-2', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

  const req: any = { json: async () => ({ orgId: '3fa85f64-5717-4562-b3fc-2c963f66afa6', name: 'Acme X' }) }
    const res = await PATCH(req as any, { params: { id: 'camp-1' } } as any)

    expect((res as any).status).toBe(403)
  })

  test('DELETE removes organization when requester is owner', async () => {
    const membership = { role: 'owner' }
    const deleteResult = { error: null }

    const singleResponses: any[] = [ { data: membership }, deleteResult ]
    const { fakeSupabase, chain } = createFakeSupabase({ userId: 'user-1', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const req: any = { nextUrl: { searchParams: { get: () => 'org-1' } } }
    const res = await DELETE(req as any, { params: { id: 'camp-1' } } as any)

    expect((res as any).status).toBe(200)
    expect(chain.delete).toHaveBeenCalled()
  })

  test('DELETE returns 403 when requester is not owner', async () => {
    const membership = { role: 'co-gm' }
    const singleResponses: any[] = [ { data: membership } ]
    const { fakeSupabase } = createFakeSupabase({ userId: 'user-2', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const req: any = { nextUrl: { searchParams: { get: () => 'org-1' } } }
    const res = await DELETE(req as any, { params: { id: 'camp-1' } } as any)

    expect((res as any).status).toBe(403)
  })
})
