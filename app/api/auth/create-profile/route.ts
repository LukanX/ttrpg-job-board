import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { userId, email, displayName, role } = await request.json()

    // Validate inputs
    if (!userId || !email || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!['gm', 'player'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    // Create service role client (bypasses RLS for this request)
    let supabaseAdmin
    try {
      supabaseAdmin = createAdminClient()
    } catch (err) {
      console.error('Failed to create Supabase service client:', err)
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Create user profile using admin client (bypasses RLS)
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        email,
        display_name: displayName,
        role,
      })

    if (profileError) {
      console.error('Profile creation error:', profileError)
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      )
    }

    // After creating the profile, check for any pending campaign invitations for this email
    try {
      const { data: invites, error: invitesError } = await supabaseAdmin
        .from('campaign_invitations')
        .select('id, campaign_id, role')
        .eq('email', email)
        .eq('accepted', false)

      if (!invitesError && invites && invites.length > 0) {
        for (const inv of invites) {
          // Insert member record for each invitation (ignore duplicates)
          try {
            await supabaseAdmin.from('campaign_members').insert({
              campaign_id: inv.campaign_id,
              user_id: userId,
              role: inv.role,
            })
          } catch (ie) {
            // ignore duplicate or other insert errors for now
            console.warn('Ignoring campaign_members insert error:', ie)
          }

          // Mark invitation accepted
          try {
            await supabaseAdmin
              .from('campaign_invitations')
              .update({ accepted: true, invited_user_id: userId, accepted_at: new Date().toISOString() })
              .eq('id', inv.id)
          } catch (ue) {
            console.warn('Failed to mark invitation accepted:', ue)
          }
        }
      }
    } catch (err) {
      console.error('Error processing invitations for new user:', err)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
