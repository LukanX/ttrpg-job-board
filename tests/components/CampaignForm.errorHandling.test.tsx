import React from 'react'
// Mock nanoid
jest.mock('nanoid', () => ({ nanoid: () => 'fixedshare' }))

// Mock the browser Supabase client used by the component to avoid requiring env vars
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
    from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'camp-1' } } ) }) }) }),
  }),
}))

/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CampaignForm from '@/components/gm/CampaignForm'

// Provide a controlled mock for next/navigation's useRouter so we can assert router calls
const mockPush = jest.fn()
const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush, refresh: mockRefresh }) }))

describe('CampaignForm error handling', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  test('shows server error when PATCH returns non-ok and does not navigate', async () => {
    // Mock fetch to return non-ok response with JSON error
    const mockFetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Not authorized' }) })
    global.fetch = mockFetch as any

    const campaign = { id: 'camp-1', name: 'Old Campaign', party_level: 3 }
    render(<CampaignForm campaign={campaign} />)

  // Submit form
  await userEvent.click(screen.getByRole('button', { name: /Save Changes/i }))

    // Wait for the server error to appear
    expect(await screen.findByText(/Not authorized/i)).toBeInTheDocument()

    // Router should not have been pushed
    expect(mockPush).not.toHaveBeenCalled()
  })
})
