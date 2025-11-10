import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// Schema for adding a member
const AddMemberSchema = z.object({
  email: z.string().email('Valid email required'),
  role: z.enum(['co-gm', 'viewer']),
})

// Schema for updating a member
const UpdateMemberSchema = z.object({
  memberId: z.string().uuid('Valid member ID required'),
  role: z.enum(['co-gm', 'viewer']),
})

/**
 * GET /api/campaigns/[id]/members
 * List all members of a campaign
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

    // Check if user is a member of the campaign
    const { data: membership } = await supabase
      .from('campaign_members')
      .select('role')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Fetch all members with user details
    const { data: members, error } = await supabase
      .from('campaign_members')
      .select(
        `
        id,
        campaign_id,
        user_id,
        role,
        created_at,
        users:user_id (
          id,
          email,
          display_name
        )
      `
      )
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching members:', error)
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
    }

    return NextResponse.json({ members })
  } catch (err) {
    console.error('GET /api/campaigns/:id/members error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/campaigns/[id]/members
 * Add a new member to a campaign (owner only)
 */
export async function POST(
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

    // Check if user is an owner
    const { data: membership } = await supabase
      .from('campaign_members')
      .select('role')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (!membership || membership.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only campaign owners can add members' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const parse = AddMemberSchema.safeParse(body)

    if (!parse.success) {
      return NextResponse.json({ error: parse.error.flatten() }, { status: 400 })
    }

    const { email, role } = parse.data

    // Find user by email
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id, email, display_name')
      .eq('email', email)
      .single()

    if (userError || !targetUser) {
      return NextResponse.json(
        { error: 'User not found with that email' },
        { status: 404 }
      )
    }

    // Check if user is already a member
    const { data: existing } = await supabase
      .from('campaign_members')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('user_id', targetUser.id)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'User is already a member of this campaign' },
        { status: 400 }
      )
    }

    // Add member
    const { data: newMember, error: insertError } = await supabase
      .from('campaign_members')
      .insert({
        campaign_id: campaignId,
        user_id: targetUser.id,
        role,
      })
      .select(
        `
        id,
        campaign_id,
        user_id,
        role,
        created_at,
        users:user_id (
          id,
          email,
          display_name
        )
      `
      )
      .single()

    if (insertError) {
      console.error('Error adding member:', insertError)
      return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
    }

    return NextResponse.json({ member: newMember }, { status: 201 })
  } catch (err) {
    console.error('POST /api/campaigns/:id/members error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/campaigns/[id]/members
 * Update a member's role (owner only)
 */
export async function PATCH(
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

    // Check if user is an owner
    const { data: membership } = await supabase
      .from('campaign_members')
      .select('role')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (!membership || membership.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only campaign owners can update member roles' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const parse = UpdateMemberSchema.safeParse(body)

    if (!parse.success) {
      return NextResponse.json({ error: parse.error.flatten() }, { status: 400 })
    }

    const { memberId, role } = parse.data

    // Prevent changing owner role
    const { data: targetMember } = await supabase
      .from('campaign_members')
      .select('role, user_id')
      .eq('id', memberId)
      .eq('campaign_id', campaignId)
      .single()

    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    if (targetMember.role === 'owner') {
      return NextResponse.json(
        { error: 'Cannot change owner role. Transfer ownership separately.' },
        { status: 400 }
      )
    }

    // Update member role
    const { data: updated, error: updateError } = await supabase
      .from('campaign_members')
      .update({ role })
      .eq('id', memberId)
      .select(
        `
        id,
        campaign_id,
        user_id,
        role,
        created_at,
        users:user_id (
          id,
          email,
          display_name
        )
      `
      )
      .single()

    if (updateError) {
      console.error('Error updating member:', updateError)
      return NextResponse.json({ error: 'Failed to update member' }, { status: 500 })
    }

    return NextResponse.json({ member: updated })
  } catch (err) {
    console.error('PATCH /api/campaigns/:id/members error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/campaigns/[id]/members?memberId=xxx
 * Remove a member from a campaign (owner only, cannot remove owner)
 */
export async function DELETE(
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

    // Check if user is an owner
    const { data: membership } = await supabase
      .from('campaign_members')
      .select('role')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (!membership || membership.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only campaign owners can remove members' },
        { status: 403 }
      )
    }

    // Get memberId from query params
    const memberId = request.nextUrl.searchParams.get('memberId')
    if (!memberId) {
      return NextResponse.json({ error: 'memberId query parameter required' }, { status: 400 })
    }

    // Prevent removing owner
    const { data: targetMember } = await supabase
      .from('campaign_members')
      .select('role')
      .eq('id', memberId)
      .eq('campaign_id', campaignId)
      .single()

    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    if (targetMember.role === 'owner') {
      return NextResponse.json(
        { error: 'Cannot remove campaign owner' },
        { status: 400 }
      )
    }

    // Remove member
    const { error: deleteError } = await supabase
      .from('campaign_members')
      .delete()
      .eq('id', memberId)

    if (deleteError) {
      console.error('Error removing member:', deleteError)
      return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Member removed successfully' })
  } catch (err) {
    console.error('DELETE /api/campaigns/:id/members error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
