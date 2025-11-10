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

  test('returns 404 when authenticated but not a member', async () => {
    const membership = { data: null, error: { message: 'Not found' } } // Not a member
    const { fakeSupabase } = createFakeSupabase({ 
      userId: 'user-1', 
      singleResponses: [membership] 
    })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const req: any = { json: async () => ({ name: 'New Name', party_level: 5 }) }
    const res = await PATCH(req, { params: { id: 'camp-1' } } as any)

    // Returns 404 to avoid revealing campaign existence to non-members
    expect((res as any).status).toBe(404)
  })

  test('returns 404 when campaign not found', async () => {
    const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses: [{ data: null, error: null }] })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

  const req: any = { json: async () => ({ name: 'New Name', party_level: 5 }) }
    const res = await PATCH(req, { params: { id: 'camp-xyz' } } as any)

    expect((res as any).status).toBe(404)
  })

  test('returns 500 when DB returns an error', async () => {
    const membershipData = { campaign_id: 'camp-1', user_id: 'user-1', role: 'owner' }
    const existingCampaign = { id: 'camp-1', gm_id: 'user-1', name: 'Old', party_level: 3 }
    // Responses: membership check succeeds, campaign fetch succeeds, update fails
    const singleResponses: any[] = [
      { data: membershipData, error: null },
      { data: existingCampaign, error: null },
      { data: null, error: { message: 'DB failure' } }
    ]
    const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const req: any = { json: async () => ({ name: 'New Name', party_level: 5 }) }
    // Use helper to spy+assert console.error around the async operation
    const { withConsoleErrorSpy } = require('@/tests/helpers/consoleSpy')
    await withConsoleErrorSpy(
      async () => {
        const res = await PATCH(req, { params: { id: 'camp-1' } } as any)
        expect((res as any).status).toBe(500)
        return res
      },
      async (consoleSpy: jest.SpyInstance) => {
        // Ensure two error logs happened (failure and payload)
        expect(consoleSpy).toHaveBeenCalledTimes(2)

        // First call: should indicate the update failed and include the DB error
        expect(consoleSpy.mock.calls[0][0]).toMatch(/Failed to update campaign/i)
        expect(consoleSpy.mock.calls[0][1]).toEqual(expect.objectContaining({ message: 'DB failure' }))

        // Second call: should include the payload object and campaign id
        expect(consoleSpy.mock.calls[1][0]).toMatch(/Update payload/i)
        expect(consoleSpy.mock.calls[1][1]).toEqual(
          expect.objectContaining({ name: 'New Name', party_level: 5 })
        )
        // The route logs: 'Update payload:', updatePayload, 'campaignId:', campaignId
        expect(consoleSpy.mock.calls[1][2]).toBe('campaignId:')
        expect(consoleSpy.mock.calls[1][3]).toBe('camp-1')
      }
    )
  })
})
