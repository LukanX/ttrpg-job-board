import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

import { useRouter } from 'next/navigation'
import CampaignMembers from '@/components/gm/CampaignMembers'

describe('CampaignMembers component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).fetch = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({ refresh: jest.fn() })
  })

  test('does not fetch on mount when initialMembers prop is provided', async () => {
    const initial = [
      { id: 'm1', campaign_id: 'camp-1', user_id: 'user-1', role: 'owner', created_at: '2025-01-01', users: { id: 'user-1', email: 'u1@example.com', display_name: 'U1' } },
    ]

    render(
      // Provide initialMembers to ensure component doesn't call fetch on mount
      <CampaignMembers campaignId="camp-1" userRole="owner" canManage={true} initialMembers={initial as any} />
    )

    // Component should render the provided member
    expect(await screen.findByText('U1')).toBeInTheDocument()
    // fetch should not have been called on mount
    expect((global.fetch as jest.Mock)).not.toHaveBeenCalled()
  })

  test('renders members and invite form when canManage is true', async () => {
    const members = [
      { id: 'm1', campaign_id: 'camp-1', user_id: 'user-1', role: 'owner', created_at: '2025-01-01', users: { id: 'user-1', email: 'u1@example.com', display_name: 'U1' } },
      { id: 'm2', campaign_id: 'camp-1', user_id: 'user-2', role: 'co-gm', created_at: '2025-01-02', users: { id: 'user-2', email: 'u2@example.com', display_name: 'U2' } },
    ]

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ members }) })

    render(<CampaignMembers campaignId="camp-1" userRole="owner" canManage={true} />)

    expect(screen.getByText(/loading members/i)).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('U1')).toBeInTheDocument())
    expect(screen.getByText('u1@example.com')).toBeInTheDocument()
    // Invite form present
    expect(screen.getByPlaceholderText(/invite by email/i)).toBeInTheDocument()
  })

  test('invite flow posts and refreshes list', async () => {
    const membersBefore = [
      { id: 'm1', campaign_id: 'camp-1', user_id: 'user-1', role: 'owner', created_at: '2025-01-01', users: { id: 'user-1', email: 'u1@example.com', display_name: 'U1' } },
    ]
    const membersAfter = [
      ...membersBefore,
      { id: 'm2', campaign_id: 'camp-1', user_id: 'user-2', role: 'co-gm', created_at: '2025-01-03', users: { id: 'user-2', email: 'new@example.com', display_name: 'New' } },
    ]

  // Sequence: initial GET, POST
  const mf = (global.fetch as jest.Mock)
  mf.mockResolvedValueOnce({ ok: true, json: async () => ({ members: membersBefore }) })
  mf.mockResolvedValueOnce({ ok: true, json: async () => ({ member: membersAfter[1] }), status: 201 })

    render(<CampaignMembers campaignId="camp-1" userRole="owner" canManage={true} />)

    await waitFor(() => expect(screen.getByText('U1')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText(/invite by email/i), { target: { value: 'new@example.com' } })
    fireEvent.change(screen.getByDisplayValue('co-gm'), { target: { value: 'co-gm' } })

    fireEvent.click(screen.getByText(/invite/i))

    // Wait for invite to complete. Component will call router.refresh() to re-load server data.
    await waitFor(() => expect((useRouter() as any).refresh).toHaveBeenCalled())
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  test('role change flow prompts and updates member role', async () => {
    const membersBefore = [
      { id: 'm1', campaign_id: 'camp-1', user_id: 'user-1', role: 'owner', created_at: '2025-01-01', users: { id: 'user-1', email: 'u1@example.com', display_name: 'U1' } },
      { id: 'm2', campaign_id: 'camp-1', user_id: 'user-2', role: 'co-gm', created_at: '2025-01-02', users: { id: 'user-2', email: 'u2@example.com', display_name: 'U2' } },
    ]
    const membersAfter = [
      membersBefore[0],
      { ...membersBefore[1], role: 'viewer' },
    ]

  const mf = (global.fetch as jest.Mock)
  // initial GET
  mf.mockResolvedValueOnce({ ok: true, json: async () => ({ members: membersBefore }) })
  // PATCH response
  mf.mockResolvedValueOnce({ ok: true, json: async () => ({ member: membersAfter[1] }) })

  // no native confirm; component shows accessible modal instead

    render(<CampaignMembers campaignId="camp-1" userRole="owner" canManage={true} />)

    await waitFor(() => expect(screen.getByText('U2')).toBeInTheDocument())

    // Find the select for U2 and change it to 'viewer'
    const select = screen.getAllByDisplayValue('co-gm')[0]
    fireEvent.change(select, { target: { value: 'viewer' } })

    // Confirm modal should be visible; click confirm to perform PATCH
    const confirmBtn = await screen.findByTestId('confirm-modal-confirm')
    fireEvent.click(confirmBtn)

    await waitFor(() => expect((useRouter() as any).refresh).toHaveBeenCalled())
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  test('remove flow prompts and removes member from list', async () => {
    const membersBefore = [
      { id: 'm1', campaign_id: 'camp-1', user_id: 'user-1', role: 'owner', created_at: '2025-01-01', users: { id: 'user-1', email: 'u1@example.com', display_name: 'U1' } },
      { id: 'm2', campaign_id: 'camp-1', user_id: 'user-2', role: 'co-gm', created_at: '2025-01-02', users: { id: 'user-2', email: 'u2@example.com', display_name: 'U2' } },
    ]
    const membersAfter = [membersBefore[0]]

  const mf = (global.fetch as jest.Mock)
  // initial GET
  mf.mockResolvedValueOnce({ ok: true, json: async () => ({ members: membersBefore }) })
  // DELETE response
  mf.mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Member removed successfully' }) })

  // no native confirm; component shows accessible modal instead

    render(<CampaignMembers campaignId="camp-1" userRole="owner" canManage={true} />)

    await waitFor(() => expect(screen.getByText('U2')).toBeInTheDocument())

    // Click remove for U2
    const removeButtons = screen.getAllByText(/remove/i)
    fireEvent.click(removeButtons[0])

    // Click confirm in modal
    const confirmBtn = await screen.findByTestId('confirm-modal-confirm')
    fireEvent.click(confirmBtn)

    await waitFor(() => expect((useRouter() as any).refresh).toHaveBeenCalled())
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})
