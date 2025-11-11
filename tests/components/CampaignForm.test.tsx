/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
// Mock nanoid (ESM) which Jest can't parse from node_modules
jest.mock('nanoid', () => ({ nanoid: () => 'fixedshare' }))

// Mock the browser Supabase client used by the component to avoid requiring env vars
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
    from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'camp-1' } } ) }) }) }),
  }),
}))

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CampaignForm from '@/components/gm/CampaignForm'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch as any

// Provide a controlled mock for next/navigation's useRouter so we can assert router calls
const mockPush = jest.fn()
const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush, refresh: mockRefresh }) }))

describe('CampaignForm', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  test('renders with initial campaign and submits PATCH', async () => {
    const campaign = { id: 'camp-1', name: 'Old Campaign', party_level: 3 }

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ campaign }) })

    render(<CampaignForm campaign={campaign} />)

    // Ensure initial values rendered
    expect(screen.getByLabelText(/Campaign Name/i)).toHaveValue('Old Campaign')

  // Submit form
  await userEvent.click(screen.getByRole('button', { name: /Save Changes/i }))

  await waitFor(() => expect(mockFetch).toHaveBeenCalled())

    expect(mockFetch).toHaveBeenCalledWith('/api/campaigns/camp-1', expect.any(Object))
    expect(mockPush).toHaveBeenCalledWith('/gm/campaigns/camp-1')
    expect(mockRefresh).toHaveBeenCalled()
  })
})
