import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendInviteEmail } from '@/lib/mailer/sendgrid'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invId: string }> }
) {
  try {
    const { id: campaignId, invId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check owner
    const { data: membership } = await supabase
      .from('campaign_members')
      .select('role')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (!membership || membership.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can resend invitations' }, { status: 403 })
    }

    // Fetch invitation
    const { data: invitation } = await supabase
      .from('campaign_invitations')
      .select('id, email, token')
      .eq('id', invId)
      .eq('campaign_id', campaignId)
      .single()

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    // Try to get campaign name for email
    const { data: campaignData } = await supabase
      .from('campaigns')
      .select('name')
      .eq('id', campaignId)
      .single()

    try {
      await sendInviteEmail(invitation.email, invitation.token, campaignData?.name)
    } catch (err) {
      console.warn('Failed to resend invite email (non-fatal):', err)
    }

    // Extend expiry when resending: add 30 days from now
    try {
      const EXPIRY_DAYS = 30
      const newExpires = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const { data: updated, error: updateErr } = await supabase
        .from('campaign_invitations')
        .update({ expires_at: newExpires })
        .eq('id', invitation.id)
        .select('id, email, token, expires_at')
        .single()

      if (updateErr) {
        console.warn('Failed to extend invitation expiry (non-fatal):', updateErr)
      }

      return NextResponse.json({ ok: true, invitation: updated })
    } catch (err) {
      console.warn('Failed to extend expiry after resend (non-fatal):', err)
      return NextResponse.json({ ok: true })
    }
  } catch (err) {
    console.error('POST /invitations/:invId/resend error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
