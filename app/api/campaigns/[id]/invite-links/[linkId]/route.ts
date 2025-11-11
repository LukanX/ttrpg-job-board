import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * DELETE /api/campaigns/[id]/invite-links/[linkId]
 * Revoke (deactivate) an invite link (owner only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  try {
    const { id: campaignId, linkId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is an owner
    const { data: membership } = await supabase
      .from('campaign_members')
      .select('role')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (!membership || membership.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only campaign owners can revoke invite links' },
        { status: 403 }
      )
    }

    // Verify the invite link belongs to this campaign
    const { data: inviteLink } = await supabase
      .from('campaign_invite_links')
      .select('id')
      .eq('id', linkId)
      .eq('campaign_id', campaignId)
      .single()

    if (!inviteLink) {
      return NextResponse.json({ error: 'Invite link not found' }, { status: 404 })
    }

    // Deactivate the invite link
    const { error: updateError } = await supabase
      .from('campaign_invite_links')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: user.id,
      })
      .eq('id', linkId)

    if (updateError) {
      console.error('Error revoking invite link:', updateError)
      return NextResponse.json({ error: 'Failed to revoke invite link' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Invite link revoked successfully' })
  } catch (err) {
    console.error('DELETE /api/campaigns/:id/invite-links/:linkId error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
