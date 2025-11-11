import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const PatchSchema = z.object({
  orgId: z.string().uuid('Valid organization ID required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().nullable().optional(),
  faction_type: z.string().nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check owner
    const { data: membership } = await supabase
      .from('campaign_members')
      .select('role')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (!membership || membership.role !== 'owner') {
      return NextResponse.json({ error: 'Only campaign owners can update organizations' }, { status: 403 })
    }

    const body = await request.json()
    const parse = PatchSchema.safeParse(body)
    if (!parse.success) return NextResponse.json({ error: parse.error.flatten() }, { status: 400 })

    const { orgId, name, description, faction_type } = parse.data

    const { data: updated, error } = await supabase
      .from('organizations')
      .update({ name, description: description ?? null, faction_type: faction_type ?? null })
      .eq('id', orgId)
      .eq('campaign_id', campaignId)
      .select('id, campaign_id, name, description, faction_type, created_at')
      .single()

    if (error) {
      console.error('Error updating organization:', error)
      return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 })
    }

    return NextResponse.json({ organization: updated })
  } catch (err) {
    console.error('PATCH /api/campaigns/:id/organizations error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check owner
    const { data: membership } = await supabase
      .from('campaign_members')
      .select('role')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (!membership || membership.role !== 'owner') {
      return NextResponse.json({ error: 'Only campaign owners can delete organizations' }, { status: 403 })
    }

    const orgId = request.nextUrl.searchParams.get('orgId')
    if (!orgId) return NextResponse.json({ error: 'orgId query parameter required' }, { status: 400 })

    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', orgId)
      .eq('campaign_id', campaignId)

    if (error) {
      console.error('Error deleting organization:', error)
      // If fk constraint, present friendly message
      return NextResponse.json({ error: error.message || 'Failed to delete organization' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/campaigns/:id/organizations error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Allow owners and co-gms to create organizations
    const { data: membership } = await supabase
      .from('campaign_members')
      .select('role')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (!membership || !['owner', 'co-gm'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only campaign owners or co-gms can create organizations' }, { status: 403 })
    }

    const body = await request.json()
    const schema = z.object({ name: z.string().min(1), description: z.string().nullable().optional(), faction_type: z.string().nullable().optional() })
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { name, description, faction_type } = parsed.data

    const { data: created, error } = await supabase
      .from('organizations')
      .insert({ campaign_id: campaignId, name, description: description ?? null, faction_type: faction_type ?? null })
      .select('id, campaign_id, name, description, faction_type, created_at')
      .single()

    if (error) {
      console.error('Error creating organization:', error)
      return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 })
    }

    return NextResponse.json({ organization: created }, { status: 201 })
  } catch (err) {
    console.error('POST /api/campaigns/:id/organizations error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
