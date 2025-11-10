import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
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
      return NextResponse.json({ error: 'Only owners can revoke invitations' }, { status: 403 })
    }

    // Ensure invitation exists
    const { data: invitation } = await supabase
      .from('campaign_invitations')
      .select('id')
      .eq('id', invId)
      .eq('campaign_id', campaignId)
      .single()

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    // Delete invitation
    const { error: deleteError } = await supabase
      .from('campaign_invitations')
      .delete()
      .eq('id', invId)

    if (deleteError) {
      console.error('Error deleting invitation:', deleteError)
      return NextResponse.json({ error: 'Failed to revoke invitation' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Invitation revoked' })
  } catch (err) {
    console.error('DELETE /invitations/:invId error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
