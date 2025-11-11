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
    const existingProfileRes = await serviceClient
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single()

    const existingProfile = existingProfileRes?.data ?? null

    if (!existingProfile) {
      console.log('User profile does not exist, creating it now')
      const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'User'
      const role = user.user_metadata?.role || 'player'

      const profileRes = await serviceClient
        .from('users')
        .insert({
          id: user.id,
          email: user.email!,
          display_name: displayName,
          role: role,
        })

      const profileError = profileRes?.error ?? null

      if (profileError) {
        console.error('Failed to create user profile:', profileError)
        return NextResponse.json({
          error: 'Failed to create user profile. Please contact support.',
        }, { status: 500 })
      }
    }

    // Add member (use service role to bypass RLS)
    const insertRes = await serviceClient
      .from('campaign_members')
      .insert({
        campaign_id: invitation.campaign_id,
        user_id: user.id,
        role: invitation.role,
      })

    const insertError = insertRes?.error ?? null

    if (insertError) {
      // Check if it's a duplicate (user already a member)
      const ie = insertError as unknown as Record<string, unknown>
      if (typeof ie?.code === 'string' && ie.code === '23505') {
        console.log('User already a member, continuing to mark invitation accepted')
      } else {
        console.error('Failed to add campaign member:', insertError)
        const msg = typeof ie?.message === 'string' ? ie.message : String(insertError)
        return NextResponse.json({
          error: `Failed to add member to campaign: ${msg}`,
        }, { status: 500 })
      }
    }

    // Mark invitation as accepted (use service role to ensure it works)
    const updateRes = await serviceClient
      .from('campaign_invitations')
      .update({ accepted: true, invited_user_id: user.id, accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)

    const updateErr = updateRes?.error ?? null

    if (updateErr) {
      console.error('Failed to mark invitation accepted:', updateErr)
      const ue = updateErr as unknown as Record<string, unknown>
      const msg = typeof ue?.message === 'string' ? ue.message : String(updateErr)
      return NextResponse.json({
        error: `Failed to mark invitation as accepted: ${msg}`,
      }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/invitations/accept error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
