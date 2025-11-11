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
 * GET /api/campaigns/[id]/join-requests
 * List all join requests for a campaign (owner only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params
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
        { error: 'Only campaign owners can view join requests' },
        { status: 403 }
      )
    }

    // Fetch all join requests with user details
    const { data: joinRequests, error } = await supabase
      .from('campaign_join_requests')
      .select(`
        id,
        campaign_id,
        user_id,
        invite_link_id,
        status,
        requested_at,
        reviewed_at,
        reviewed_by,
        users:user_id (
          id,
          email,
          display_name
        )
      `)
      .eq('campaign_id', campaignId)
      .order('requested_at', { ascending: false })

    if (error) {
      console.error('Error fetching join requests:', error)
      return NextResponse.json({ error: 'Failed to fetch join requests' }, { status: 500 })
    }

    return NextResponse.json({ joinRequests })
  } catch (err) {
    console.error('GET /api/campaigns/:id/join-requests error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
