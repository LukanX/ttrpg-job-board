/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

import { useRouter } from 'next/navigation'
import AcceptInviteButton from '@/components/AcceptInviteButton'

describe('AcceptInviteButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).fetch = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({ refresh: jest.fn() })
  })

  test('posts token, refreshes and shows success message', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })

    render(<AcceptInviteButton token="t1" />)

    const btn = screen.getByRole('button', { name: /accept invitation/i })
    fireEvent.click(btn)

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(global.fetch).toHaveBeenCalledWith('/api/invitations/accept', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 't1' }),
    }))

    // router.refresh should be called
    expect((useRouter() as any).refresh).toHaveBeenCalled()

    // Success message
    expect(await screen.findByText(/invitation accepted/i)).toBeInTheDocument()
  })

  test('shows error when accept fails', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'bad' }) })

    render(<AcceptInviteButton token="t1" />)

    const btn = screen.getByRole('button', { name: /accept invitation/i })
    fireEvent.click(btn)

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(await screen.findByText(/failed to accept invitation/i)).toBeInTheDocument()
  })
})
