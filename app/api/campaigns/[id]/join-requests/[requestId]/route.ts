import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * PATCH /api/campaigns/[id]/join-requests/[requestId]
 * Approve or reject a join request (owner only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  try {
    const { requestId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    // Call Security Definer function to review join request
    // This function handles authorization checking, status update, and member insertion
    const { data, error } = await supabase.rpc('review_join_request', {
      request_id: requestId,
      action: action,
    })

    if (error) {
      console.error('Failed to review join request:', error)
      
      // Map common error messages to appropriate HTTP status codes
      if (error.message.includes('Not authenticated')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.includes('Only campaign owners')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
      if (error.message.includes('not found') || error.message.includes('already reviewed')) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      if (error.message.includes('Invalid action')) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      
      return NextResponse.json(
        { error: error.message || 'Failed to review join request' },
        { status: 500 }
      )
    }

    // Parse the result from the function
    const result = typeof data === 'string' ? JSON.parse(data) : data

    return NextResponse.json({
      message: result.message,
      status: result.status,
    })
  } catch (err) {
    console.error('PATCH /api/campaigns/:id/join-requests/:requestId error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
