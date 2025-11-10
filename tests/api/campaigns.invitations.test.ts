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

// Mock mailer
jest.mock('@/lib/mailer/sendgrid', () => ({
  sendInviteEmail: jest.fn(),
}))

import { POST as resendPOST } from '@/app/api/campaigns/[id]/invitations/[invId]/resend/route'
import { DELETE as revokeDELETE } from '@/app/api/campaigns/[id]/invitations/[invId]/route'
import { createFakeSupabase } from '@/tests/helpers/supabaseMock'
import { createClient as mockCreateClient } from '@/lib/supabase/server'
import { sendInviteEmail } from '@/lib/mailer/sendgrid'

describe('Campaign invitations API', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  test('resend endpoint calls mailer and returns ok for owner', async () => {
    // membership -> owner, invitation lookup -> data, campaign name -> data
    const singleResponses: any[] = [ { data: { role: 'owner' } }, { data: { id: 'inv-1', email: 'a@ex.com', token: 't1' } }, { data: { name: 'My Camp' } } ]
    const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    ;(sendInviteEmail as jest.Mock).mockResolvedValue(null)

    const res = await resendPOST({} as any, { params: { id: 'camp-1', invId: 'inv-1' } } as any)

    expect((res as any).status).toBe(200)
    expect(sendInviteEmail).toHaveBeenCalledWith('a@ex.com', 't1', 'My Camp')
  })

  test('revoke endpoint deletes invitation for owner', async () => {
    // membership -> owner, invitation exists -> data, delete -> returns success
    const singleResponses: any[] = [ { data: { role: 'owner' } }, { data: { id: 'inv-1' } }, { data: null } ]
    const { fakeSupabase } = createFakeSupabase({ userId: 'user-1', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const res = await revokeDELETE({} as any, { params: { id: 'camp-1', invId: 'inv-1' } } as any)

    expect((res as any).status).toBe(200)
  })

  test('resend endpoint returns 403 when requester is not owner', async () => {
    // membership -> co-gm (not owner)
    const singleResponses: any[] = [ { data: { role: 'co-gm' } } ]
    const { fakeSupabase } = createFakeSupabase({ userId: 'user-2', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const res = await resendPOST({} as any, { params: { id: 'camp-1', invId: 'inv-1' } } as any)

    expect((res as any).status).toBe(403)
    expect(sendInviteEmail).not.toHaveBeenCalled()
  })

  test('revoke endpoint returns 403 when requester is not owner', async () => {
    // membership -> viewer (not owner)
    const singleResponses: any[] = [ { data: { role: 'viewer' } } ]
    const { fakeSupabase } = createFakeSupabase({ userId: 'user-3', singleResponses })
    ;(mockCreateClient as jest.Mock).mockResolvedValue(fakeSupabase)

    const res = await revokeDELETE({} as any, { params: { id: 'camp-1', invId: 'inv-1' } } as any)

    expect((res as any).status).toBe(403)
  })
})
