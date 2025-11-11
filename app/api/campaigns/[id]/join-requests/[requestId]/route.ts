import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Service role client for bypassing RLS when adding members
const getServiceClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !key) {
    throw new Error('Missing Supabase credentials')
  }
  
  return createServiceClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * PATCH /api/campaigns/[id]/join-requests/[requestId]
 * Approve or reject a join request (owner only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  try {
    const { id: campaignId, requestId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is a campaign owner
    const { data: membership } = await supabase
      .from('campaign_members')
      .select('role')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (!membership || membership.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only campaign owners can review join requests' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const action = body?.action // 'approve' or 'reject'

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      )
    }

    // Fetch the join request
    const { data: joinRequest, error: fetchError } = await supabase
      .from('campaign_join_requests')
      .select('id, campaign_id, user_id, status')
      .eq('id', requestId)
      .eq('campaign_id', campaignId)
      .single()

    if (fetchError || !joinRequest) {
      return NextResponse.json({ error: 'Join request not found' }, { status: 404 })
    }

    if (joinRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Join request has already been reviewed' },
        { status: 400 }
      )
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected'

    // Use service client to update join request and add member
    const serviceClient = getServiceClient()

    // Update join request status
    const { error: updateError } = await serviceClient
      .from('campaign_join_requests')
      .update({
        status: newStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq('id', requestId)

    if (updateError) {
      console.error('Error updating join request:', updateError)
      return NextResponse.json(
        { error: 'Failed to update join request' },
        { status: 500 }
      )
    }

    // If approved, add user to campaign
    if (action === 'approve') {
      // Check if user is already a member (shouldn't happen, but safety check)
      const { data: existingMember } = await serviceClient
        .from('campaign_members')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('user_id', joinRequest.user_id)
        .single()

      if (!existingMember) {
        const { error: memberError } = await serviceClient
          .from('campaign_members')
          .insert({
            campaign_id: campaignId,
            user_id: joinRequest.user_id,
            role: 'viewer', // Default role for approved join requests
          })

        if (memberError) {
          console.error('Error adding member:', memberError)
          return NextResponse.json(
            { error: 'Failed to add member to campaign' },
            { status: 500 }
          )
        }
      }
    }

    return NextResponse.json({
      message: `Join request ${newStatus}`,
      status: newStatus,
    })
  } catch (err) {
    console.error('PATCH /api/campaigns/:id/join-requests/:requestId error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
