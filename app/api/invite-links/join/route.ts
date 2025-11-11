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

    // Find invite link by token
    const { data: inviteLink, error: linkError } = await supabase
      .from('campaign_invite_links')
      .select('id, campaign_id, token, expires_at, max_uses, use_count, require_approval, is_active')
      .eq('token', token)
      .single()

    if (linkError || !inviteLink) {
      return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 })
    }

    // Validate invite link is active
    if (!inviteLink.is_active) {
      return NextResponse.json({ error: 'This invite link has been revoked' }, { status: 410 })
    }

    // Validate expiry
    if (inviteLink.expires_at) {
      const expiryDate = new Date(inviteLink.expires_at)
      if (expiryDate <= new Date()) {
        return NextResponse.json({ error: 'This invite link has expired' }, { status: 410 })
      }
    }

    // Validate max uses
    if (inviteLink.max_uses !== null && inviteLink.use_count >= inviteLink.max_uses) {
      return NextResponse.json(
        { error: 'This invite link has reached its maximum number of uses' },
        { status: 410 }
      )
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('campaign_members')
      .select('id')
      .eq('campaign_id', inviteLink.campaign_id)
      .eq('user_id', user.id)
      .single()

    if (existingMember) {
      return NextResponse.json(
        { error: 'You are already a member of this campaign' },
        { status: 400 }
      )
    }

    // Check if approval is required
    if (inviteLink.require_approval) {
      // Check for existing join request
      const { data: existingRequest } = await supabase
        .from('campaign_join_requests')
        .select('id, status')
        .eq('campaign_id', inviteLink.campaign_id)
        .eq('user_id', user.id)
        .single()

      if (existingRequest) {
        if (existingRequest.status === 'pending') {
          return NextResponse.json(
            { 
              requiresApproval: true,
              status: 'pending',
              message: 'Your join request is pending approval'
            },
            { status: 200 }
          )
        } else if (existingRequest.status === 'rejected') {
          return NextResponse.json(
            { error: 'Your previous join request was rejected' },
            { status: 403 }
          )
        }
      }

      // Create join request
      const { data: joinRequest, error: requestError } = await supabase
        .from('campaign_join_requests')
        .insert({
          campaign_id: inviteLink.campaign_id,
          user_id: user.id,
          invite_link_id: inviteLink.id,
          status: 'pending',
        })
        .select('id, campaign_id, user_id, status, requested_at')
        .single()

      if (requestError) {
        console.error('Error creating join request:', requestError)
        return NextResponse.json(
          { error: 'Failed to create join request' },
          { status: 500 }
        )
      }

      // Increment use count
      await supabase
        .from('campaign_invite_links')
        .update({ use_count: inviteLink.use_count + 1 })
        .eq('id', inviteLink.id)

      return NextResponse.json(
        { 
          requiresApproval: true,
          status: 'pending',
          joinRequest,
          message: 'Join request submitted. Waiting for campaign owner approval.'
        },
        { status: 201 }
      )
    }

    // No approval required - add user directly
    // Use service role client to bypass RLS
    let serviceClient
    try {
      serviceClient = getServiceClient()
    } catch (err) {
      console.error('Failed to create service client:', err)
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Ensure user profile exists
    const { data: existingProfile } = await serviceClient
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!existingProfile) {
      const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'User'
      const role = user.user_metadata?.role || 'player'

      const { error: profileError } = await serviceClient
        .from('users')
        .insert({
          id: user.id,
          email: user.email!,
          display_name: displayName,
          role: role,
        })

      if (profileError) {
        console.error('Failed to create user profile:', profileError)
        return NextResponse.json(
          { error: 'Failed to create user profile' },
          { status: 500 }
        )
      }
    }

    // Add member with 'viewer' role (default for invite link joins)
    const { data: newMember, error: memberError } = await serviceClient
      .from('campaign_members')
      .insert({
        campaign_id: inviteLink.campaign_id,
        user_id: user.id,
        role: 'viewer',
      })
      .select('id, campaign_id, user_id, role, created_at')
      .single()

    if (memberError) {
      console.error('Failed to add campaign member:', memberError)
      return NextResponse.json(
        { error: 'Failed to join campaign' },
        { status: 500 }
      )
    }

    // Increment use count
    await serviceClient
      .from('campaign_invite_links')
      .update({ use_count: inviteLink.use_count + 1 })
      .eq('id', inviteLink.id)

    return NextResponse.json(
      {
        requiresApproval: false,
        member: newMember,
        message: 'Successfully joined campaign'
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('POST /api/invite-links/join error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
