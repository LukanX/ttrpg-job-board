import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'

// Schema for creating an invite link
const CreateInviteLinkSchema = z.object({
  expiresAt: z.string().datetime().optional().nullable(),
  maxUses: z.number().int().positive().optional().nullable(),
  requireApproval: z.boolean().default(false),
})

/**
 * GET /api/campaigns/[id]/invite-links
 * List all invite links for a campaign (members only)
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

    // Fetch all invite links
    const { data: inviteLinks, error } = await supabase
      .from('campaign_invite_links')
      .select(`
        id,
        campaign_id,
        token,
        created_by,
        expires_at,
        max_uses,
        use_count,
        require_approval,
        is_active,
        created_at,
        revoked_at,
        revoked_by
      `)
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching invite links:', error)
      return NextResponse.json({ error: 'Failed to fetch invite links' }, { status: 500 })
    }

    return NextResponse.json({ inviteLinks })
  } catch (err) {
    console.error('GET /api/campaigns/:id/invite-links error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/campaigns/[id]/invite-links
 * Create a new shareable invite link (owner only)
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
        { error: 'Only campaign owners can create invite links' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const parse = CreateInviteLinkSchema.safeParse(body)

    if (!parse.success) {
      return NextResponse.json({ error: parse.error.flatten() }, { status: 400 })
    }

    const { expiresAt, maxUses, requireApproval } = parse.data

    // Validate expiry date is in the future
    if (expiresAt) {
      const expiryDate = new Date(expiresAt)
      if (expiryDate <= new Date()) {
        return NextResponse.json(
          { error: 'Expiry date must be in the future' },
          { status: 400 }
        )
      }
    }

    // Generate unique token
    const token = randomUUID()

    // Create invite link
    const { data: inviteLink, error: insertError } = await supabase
      .from('campaign_invite_links')
      .insert({
        campaign_id: campaignId,
        token,
        created_by: user.id,
        expires_at: expiresAt || null,
        max_uses: maxUses || null,
        require_approval: requireApproval,
      })
      .select(`
        id,
        campaign_id,
        token,
        created_by,
        expires_at,
        max_uses,
        use_count,
        require_approval,
        is_active,
        created_at
      `)
      .single()

    if (insertError) {
      console.error('Error creating invite link:', insertError)
      return NextResponse.json({ error: 'Failed to create invite link' }, { status: 500 })
    }

    return NextResponse.json({ inviteLink }, { status: 201 })
  } catch (err) {
    console.error('POST /api/campaigns/:id/invite-links error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
