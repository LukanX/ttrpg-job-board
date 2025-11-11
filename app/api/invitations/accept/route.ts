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

    // Use service role to bypass RLS for adding member
    let serviceClient
    try {
      serviceClient = getServiceClient()
    } catch (err) {
      console.error('Failed to create service client:', err)
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    
    // Ensure user profile exists in public.users table before adding to campaign
    // This handles the case where a user signed up but their profile wasn't created
    const { data: existingProfile } = await serviceClient
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single()
    
    if (!existingProfile) {
      console.log('User profile does not exist, creating it now')
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
        return NextResponse.json({ 
          error: 'Failed to create user profile. Please contact support.' 
        }, { status: 500 })
      }
    }
    
    // Add member (use service role to bypass RLS)
    const { error: insertError } = await serviceClient
      .from('campaign_members')
      .insert({
        campaign_id: invitation.campaign_id,
        user_id: user.id,
        role: invitation.role,
      })

    if (insertError) {
      // Check if it's a duplicate (user already a member)
      if (insertError.code === '23505') {
        console.log('User already a member, continuing to mark invitation accepted')
      } else {
        console.error('Failed to add campaign member:', insertError)
        return NextResponse.json({ 
          error: `Failed to add member to campaign: ${insertError.message}` 
        }, { status: 500 })
      }
    }

    // Mark invitation as accepted (use service role to ensure it works)
    const { error: updateErr } = await serviceClient
      .from('campaign_invitations')
      .update({ accepted: true, invited_user_id: user.id, accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)

    if (updateErr) {
      console.error('Failed to mark invitation accepted:', updateErr)
      return NextResponse.json({ 
        error: `Failed to mark invitation as accepted: ${updateErr.message}` 
      }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/invitations/accept error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
