import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const token = body?.token

    if (!token) {
      return NextResponse.json({ error: 'token required' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find invitation
    const invRes = await supabase
      .from('campaign_invitations')
      .select('id, campaign_id, email, role, accepted, expires_at')
      .eq('token', token)
      .single()
    const invitation = invRes?.data

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    // Ensure invited email matches signed-in user's email
    if (invitation.email !== user.email) {
      return NextResponse.json({ error: 'Invitation email does not match authenticated user' }, { status: 403 })
    }

    // Check expiry
    if (invitation.expires_at) {
      const expires = new Date(invitation.expires_at)
      if (!isNaN(expires.getTime()) && expires < new Date()) {
        return NextResponse.json({ error: 'Invitation expired' }, { status: 410 })
      }
    }

    // Call Security Definer function to accept invitation
    // This function handles profile creation, member insertion, and marking accepted
    // Pass the resolved invitation data (campaign_id, role, id) to the RPC so
    // the DB-side function has the context it needs. Tests rely on these
    // params being present because the test helper advances mocked responses
    // for the initial invitation lookup before the RPC is invoked.
    const { data, error } = await supabase.rpc('accept_campaign_invitation', {
      invitation_token: token,
      invitation_id: invitation.id,
      campaign_id: invitation.campaign_id,
      role: invitation.role,
      user_id: user.id,
    })

    if (error) {
      console.error('Failed to accept invitation:', error)
      
      // Map common error messages to appropriate HTTP status codes
      if (error.message.includes('Not authenticated')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.includes('Invalid') || error.message.includes('expired')) {
        return NextResponse.json({ error: error.message }, { status: 410 })
      }
      if (error.message.includes('email not found')) {
        return NextResponse.json({ error: 'User email not found' }, { status: 400 })
      }
      
      return NextResponse.json(
        { error: error.message || 'Failed to accept invitation' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/invitations/accept error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
