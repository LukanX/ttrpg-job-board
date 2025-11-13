import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/invite-links/join
 * Join a campaign via shareable invite link or create a join request if approval is required
 */
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

    // Call Security Definer function to handle invite link join
    // This function handles all validation, profile creation, and member/request creation
    const { data, error } = await supabase.rpc('join_via_invite_link', {
      link_token: token,
    })

    if (error) {
      console.error('Failed to join via invite link:', error)
      
      // Map common error messages to appropriate HTTP status codes
      if (error.message.includes('Not authenticated')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.includes('Invalid') || error.message.includes('expired') || error.message.includes('exhausted')) {
        return NextResponse.json({ error: error.message }, { status: 410 })
      }
      if (error.message.includes('already a member')) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      if (error.message.includes('rejected')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
      
      return NextResponse.json(
        { error: error.message || 'Failed to join campaign' },
        { status: 500 }
      )
    }

    // Parse the result from the function
    const result = typeof data === 'string' ? JSON.parse(data) : data

    // Return appropriate status based on whether approval is required
    if (result.requiresApproval && result.status === 'pending') {
      return NextResponse.json(result, { status: 201 })
    }

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error('POST /api/invite-links/join error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
