import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const token = body?.token

    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

    const supabase = await createClient()

    const userRes = await supabase.auth.getUser()
    const user = userRes?.data?.user
    const authError = userRes?.error

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

    // If already accepted, return success
    if (invitation.accepted) {
      return NextResponse.json({ ok: true })
    }

    // Add member (ignore duplicate errors)
    try {
      await supabase.from('campaign_members').insert({
        campaign_id: invitation.campaign_id,
        user_id: user.id,
        role: invitation.role,
      })
    } catch (err) {
      // swallow insert errors (e.g., already a member) and continue
      console.warn('campaign_members insert warning (non-fatal):', err)
    }

    // Mark invitation as accepted (soft delete - keeps audit trail)
    const updateRes = await supabase
      .from('campaign_invitations')
      .update({ accepted: true, invited_user_id: user.id, accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)
    const updateErr = updateRes?.error

    if (updateErr) {
      console.error('Failed to mark invitation accepted:', updateErr)
      // non-fatal for UX — still return ok
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/invitations/accept error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
