import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Use service role to bypass RLS for user creation
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

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
