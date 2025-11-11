import { DELETE } from '@/app/api/jobs/[id]/route'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

// Mock Next.js server module
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((body, init) => ({
      json: async () => body,
      status: init?.status || 200,
    })),
  },
}))

// Mock Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

describe('DELETE /api/jobs/[id]', () => {
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()

    mockSupabase = {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn(),
    }

    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)
  })

  it('should delete dependent records and the job when user is the creator', async () => {
    const userId = 'user-creator'

    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: userId } } })

    let callCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      callCount++

      // First call: fetch job
      if (table === 'jobs' && callCount === 1) {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: 'job-id', campaign_id: 'campaign-id', created_by: userId },
            error: null,
          }),
        }
      }

      // Second call: fetch campaign
      if (table === 'campaigns') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { gm_id: 'other-gm' }, error: null }),
        }
      }

      // Deletion calls for dependent tables and final job delete
      if (table === 'encounters' || table === 'npcs' || table === 'votes' || (table === 'jobs' && callCount >= 4)) {
        return {
          delete: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          then: undefined,
          // emulate supabase response: { error: null }
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }
      }

      // Fallback
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
    })

    const response = await DELETE({} as NextRequest, { params: Promise.resolve({ id: 'job-id' }) })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
  })

  it('should return 403 if user is not creator or campaign owner', async () => {
    const userId = 'random-user'

    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: userId } } })

    let callCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      callCount++

      if (table === 'jobs' && callCount === 1) {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: 'job-id', campaign_id: 'campaign-id', created_by: 'somebody-else' },
            error: null,
          }),
        }
      }

      if (table === 'campaigns') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { gm_id: 'another-user' }, error: null }),
        }
      }

      // default
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
    })

    const response = await DELETE({} as NextRequest, { params: Promise.resolve({ id: 'job-id' }) })

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toContain('Forbidden')
  })
})
