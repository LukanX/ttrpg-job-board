import { PATCH } from '@/app/api/jobs/[id]/route'
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

describe('PATCH /api/jobs/[id]', () => {
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup default Supabase mock
    mockSupabase = {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn(),
    }
    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)
  })

  it('should return 401 if user is not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

    const request = {
      json: async () => ({ title: 'Updated Job' }),
    } as NextRequest

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'job-id' }),
    })

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('should return 400 if request body is invalid', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
    })

    const request = {
      json: async () => ({ title: '', difficulty: 'invalid' }), // Empty title, invalid difficulty
    } as NextRequest

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'job-id' }),
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invalid request')
    expect(body.details).toBeDefined()
  })

  it('should return 404 if job does not exist', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
    })

    // Mock job query to return error
    const mockFrom = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
    }
    mockSupabase.from.mockReturnValue(mockFrom)

    const request = {
      json: async () => ({ title: 'Updated Job' }),
    } as NextRequest

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'nonexistent-job-id' }),
    })

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe('Job not found')
  })

  it('should return 403 if user is not creator, owner, or co-GM', async () => {
    const userId = 'user-id'
    const creatorId = 'creator-id'
    const ownerId = 'owner-id'

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
    })

    // Setup mock chain for multiple queries
    let callCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      callCount++
      
      if (table === 'jobs' && callCount === 1) {
        // First call: fetch job
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'job-id',
              campaign_id: 'campaign-id',
              created_by: creatorId,
            },
            error: null,
          }),
        }
      } else if (table === 'campaigns') {
        // Second call: fetch campaign
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { gm_id: ownerId },
            error: null,
          }),
        }
      } else if (table === 'campaign_members') {
        // Third call: check membership
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null, // Not a member
            error: { message: 'Not found' },
          }),
        }
      }
    })

    const request = {
      json: async () => ({ title: 'Updated Job' }),
    } as NextRequest

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'job-id' }),
    })

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toContain('Forbidden')
  })

  it('should successfully update job if user is the creator', async () => {
    const userId = 'user-id'

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
    })

    let callCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      callCount++

      if (table === 'jobs' && callCount === 1) {
        // First call: fetch job
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'job-id',
              campaign_id: 'campaign-id',
              created_by: userId, // User is the creator
            },
            error: null,
          }),
        }
      } else if (table === 'campaigns') {
        // Second call: fetch campaign
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { gm_id: 'other-user-id' },
            error: null,
          }),
        }
      } else if (table === 'campaign_members') {
        // Third call: check membership
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
          }),
        }
      } else if (table === 'jobs' && callCount === 4) {
        // Fourth call: update job
        return {
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'job-id',
              title: 'Updated Job',
              description: 'Original description',
              difficulty: 5,
              updated_at: expect.any(String),
            },
            error: null,
          }),
        }
      }
    })

    const request = {
      json: async () => ({ title: 'Updated Job' }),
    } as NextRequest

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'job-id' }),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.title).toBe('Updated Job')
  })

  it('should successfully update job if user is campaign owner', async () => {
    const userId = 'user-id'

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
    })

    let callCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      callCount++

      if (table === 'jobs' && callCount === 1) {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'job-id',
              campaign_id: 'campaign-id',
              created_by: 'other-user-id',
            },
            error: null,
          }),
        }
      } else if (table === 'campaigns') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { gm_id: userId }, // User is campaign owner
            error: null,
          }),
        }
      } else if (table === 'campaign_members') {
        // This call happens even though user is owner (permission check)
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
          }),
        }
      } else if (table === 'jobs' && callCount === 4) {
        return {
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'job-id',
              title: 'Updated by Owner',
              status: 'completed',
              updated_at: expect.any(String),
            },
            error: null,
          }),
        }
      }
    })

    const request = {
      json: async () => ({ title: 'Updated by Owner', status: 'completed' }),
    } as NextRequest

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'job-id' }),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.title).toBe('Updated by Owner')
    expect(body.status).toBe('completed')
  })

  it('should successfully update job if user is a co-GM', async () => {
    const userId = 'user-id'

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
    })

    let callCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      callCount++

      if (table === 'jobs' && callCount === 1) {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'job-id',
              campaign_id: 'campaign-id',
              created_by: 'other-user-id',
            },
            error: null,
          }),
        }
      } else if (table === 'campaigns') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { gm_id: 'owner-id' },
            error: null,
          }),
        }
      } else if (table === 'campaign_members') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { role: 'co-gm' }, // User is a co-GM
            error: null,
          }),
        }
      } else if (table === 'jobs' && callCount === 4) {
        return {
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'job-id',
              gm_notes: 'Updated by co-GM',
              updated_at: expect.any(String),
            },
            error: null,
          }),
        }
      }
    })

    const request = {
      json: async () => ({ gm_notes: 'Updated by co-GM' }),
    } as NextRequest

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'job-id' }),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.gm_notes).toBe('Updated by co-GM')
  })
})
