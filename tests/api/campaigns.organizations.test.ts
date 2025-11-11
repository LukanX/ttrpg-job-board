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

import { POST, PATCH, DELETE } from '@/app/api/campaigns/[id]/organizations/route'
import { createClient as mockCreateClient } from '@/lib/supabase/server'
import { createFakeSupabase, type SupabaseRow } from '@/tests/helpers/supabaseMock'

describe('Campaign organizations API (POST/PATCH/DELETE)', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  test('POST creates organization when requester is owner', async () => {
    const membership = { role: 'owner' }
    const created = { id: 'org-1', campaign_id: 'camp-1', name: 'Acme', description: 'desc', faction_type: 'Corp' }

  const singleResponses: Array<SupabaseRow<unknown>> = [ { data: membership, error: null }, { data: created, error: null } ]
  const { fakeSupabase, chain } = createFakeSupabase({ userId: 'user-1', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

  const req = { json: async () => ({ name: 'Acme', description: 'desc', faction_type: 'Corp' }) } as unknown as Parameters<typeof POST>[0]
  const res = await POST(req, { params: { id: 'camp-1' } } as unknown as Parameters<typeof POST>[1])

  expect((res as unknown as { status: number }).status).toBe(201)
  const body = (res as unknown as { body: unknown }).body as { organization?: unknown }
  expect(body).toHaveProperty('organization')
    expect(chain.insert).toHaveBeenCalled()
  })

  test('POST returns 403 when requester is not owner/co-gm', async () => {
    const membership = { role: 'viewer' }
  const singleResponses: Array<SupabaseRow<unknown>> = [ { data: membership, error: null } ]
  const { fakeSupabase } = createFakeSupabase({ userId: 'user-2', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

  const req = { json: async () => ({ name: 'Acme' }) } as unknown as Parameters<typeof POST>[0]
  const res = await POST(req, { params: { id: 'camp-1' } } as unknown as Parameters<typeof POST>[1])

  expect((res as unknown as { status: number }).status).toBe(403)
  })

  test('PATCH updates organization when requester is owner', async () => {
    const membership = { role: 'owner' }
    const updated = { id: 'org-1', campaign_id: 'camp-1', name: 'Acme X', description: 'new', faction_type: 'Corp' }

  const singleResponses: Array<SupabaseRow<unknown>> = [ { data: membership, error: null }, { data: updated, error: null } ]
  const { fakeSupabase, chain } = createFakeSupabase({ userId: 'user-1', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const req = { json: async () => ({ orgId: '3fa85f64-5717-4562-b3fc-2c963f66afa6', name: 'Acme X', description: 'new', faction_type: 'Corp' }) } as unknown as Parameters<typeof PATCH>[0]
    const res = await PATCH(req, { params: { id: 'camp-1' } } as unknown as Parameters<typeof PATCH>[1])

  expect((res as unknown as { status: number }).status).toBe(200)
  const body = (res as unknown as { body: unknown }).body as { organization?: unknown }
  expect(body).toHaveProperty('organization')
    expect(chain.update).toHaveBeenCalled()
  })

  test('PATCH returns 403 when requester is not owner', async () => {
    const membership = { role: 'co-gm' } // only owner allowed for PATCH in current implementation
  const singleResponses: Array<SupabaseRow<unknown>> = [ { data: membership, error: null } ]
  const { fakeSupabase } = createFakeSupabase({ userId: 'user-2', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const req = { json: async () => ({ orgId: '3fa85f64-5717-4562-b3fc-2c963f66afa6', name: 'Acme X' }) } as unknown as Parameters<typeof PATCH>[0]
    const res = await PATCH(req, { params: { id: 'camp-1' } } as unknown as Parameters<typeof PATCH>[1])

    expect((res as unknown as { status: number }).status).toBe(403)
  })

  test('DELETE removes organization when requester is owner', async () => {
    const membership = { role: 'owner' }
  const deleteResult: SupabaseRow<unknown> = { data: null, error: null }

  const singleResponses: Array<SupabaseRow<unknown>> = [ { data: membership, error: null }, deleteResult ]
  const { fakeSupabase, chain } = createFakeSupabase({ userId: 'user-1', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

  const req = { nextUrl: { searchParams: { get: () => 'org-1' } } } as unknown as Parameters<typeof DELETE>[0]
  const res = await DELETE(req, { params: { id: 'camp-1' } } as unknown as Parameters<typeof DELETE>[1])

  expect((res as unknown as { status: number }).status).toBe(200)
  expect(chain.delete).toHaveBeenCalled()
  })

  test('DELETE returns 403 when requester is not owner', async () => {
    const membership = { role: 'co-gm' }
  const singleResponses: Array<SupabaseRow<unknown>> = [ { data: membership, error: null } ]
  const { fakeSupabase } = createFakeSupabase({ userId: 'user-2', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

  const req = { nextUrl: { searchParams: { get: () => 'org-1' } } } as unknown as Parameters<typeof DELETE>[0]
  const res = await DELETE(req, { params: { id: 'camp-1' } } as unknown as Parameters<typeof DELETE>[1])

  expect((res as unknown as { status: number }).status).toBe(403)
  })
})
