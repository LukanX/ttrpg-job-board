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

// Mock mailer
jest.mock('@/lib/mailer/sendgrid', () => ({
  sendInviteEmail: jest.fn(),
}))

import { POST as resendPOST } from '@/app/api/campaigns/[id]/invitations/[invId]/resend/route'
import { DELETE as revokeDELETE } from '@/app/api/campaigns/[id]/invitations/[invId]/route'
import { createFakeSupabase, type SupabaseRow } from '@/tests/helpers/supabaseMock'
import { createClient as mockCreateClient } from '@/lib/supabase/server'
import { sendInviteEmail } from '@/lib/mailer/sendgrid'

describe('Campaign invitations API', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  test('resend endpoint calls mailer and returns ok for owner', async () => {
  // membership -> owner, invitation lookup -> data, campaign name -> data
  const singleResponses: Array<SupabaseRow<Record<string, unknown>>> = [ { data: { role: 'owner' }, error: null }, { data: { id: 'inv-1', email: 'a@ex.com', token: 't1' }, error: null }, { data: { name: 'My Camp' }, error: null } ]
    const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    ;(sendInviteEmail as jest.Mock).mockResolvedValue(null)

  const res = await resendPOST({} as unknown as Parameters<typeof resendPOST>[0], { params: { id: 'camp-1', invId: 'inv-1' } } as unknown as Parameters<typeof resendPOST>[1])

  expect((res as unknown as { status: number }).status).toBe(200)
    expect(sendInviteEmail).toHaveBeenCalledWith('a@ex.com', 't1', 'My Camp')
  })

  test('revoke endpoint deletes invitation for owner', async () => {
  // membership -> owner, invitation exists -> data, delete -> returns success
  const singleResponses: Array<SupabaseRow<Record<string, unknown>>> = [ { data: { role: 'owner' }, error: null }, { data: { id: 'inv-1' }, error: null }, { data: null, error: null } ]
    const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

  const res = await revokeDELETE({} as unknown as Parameters<typeof revokeDELETE>[0], { params: { id: 'camp-1', invId: 'inv-1' } } as unknown as Parameters<typeof revokeDELETE>[1])

  expect((res as unknown as { status: number }).status).toBe(200)
  })

  test('resend endpoint returns 403 when requester is not owner', async () => {
    // membership -> co-gm (not owner)
  const singleResponses: Array<SupabaseRow<Record<string, unknown>>> = [ { data: { role: 'co-gm' }, error: null } ]
    const { fakeSupabase } = createFakeSupabase({ userId: 'user-2', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

  const res = await resendPOST({} as unknown as Parameters<typeof resendPOST>[0], { params: { id: 'camp-1', invId: 'inv-1' } } as unknown as Parameters<typeof resendPOST>[1])

  expect((res as unknown as { status: number }).status).toBe(403)
    expect(sendInviteEmail).not.toHaveBeenCalled()
  })

  test('revoke endpoint returns 403 when requester is not owner', async () => {
    // membership -> viewer (not owner)
  const singleResponses: Array<SupabaseRow<Record<string, unknown>>> = [ { data: { role: 'viewer' }, error: null } ]
    const { fakeSupabase } = createFakeSupabase({ userId: 'user-3', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

  const res = await revokeDELETE({} as unknown as Parameters<typeof revokeDELETE>[0], { params: { id: 'camp-1', invId: 'inv-1' } } as unknown as Parameters<typeof revokeDELETE>[1])

  expect((res as unknown as { status: number }).status).toBe(403)
  })
})
