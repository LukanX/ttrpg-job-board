import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const PatchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
})

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const params = await context.params
    const campaignId = params.id

    const body = await request.json()
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }

    const { id, ...updates } = parsed.data

    // Permission: campaign owner or co-gm
    const { data: campaign } = await supabase.from('campaigns').select('gm_id').eq('id', campaignId).single()

    const { data: membership } = await supabase
      .from('campaign_members')
      .select('role')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)
      .single()

    const isOwner = campaign?.gm_id === user.id
    const isCoGM = membership?.role === 'co-gm'

    if (!isOwner && !isCoGM) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Ensure mission type belongs to campaign
    const { data: mt } = await supabase.from('mission_types').select('id,campaign_id').eq('id', id).single()
    if (!mt || mt.campaign_id !== campaignId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: updated, error } = await supabase
      .from('mission_types')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update mission type:', error)
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('PATCH mission-types error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const params = await context.params
    const campaignId = params.id

    const body = await request.json()
    const id = body?.id
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    // Permission: campaign owner or co-gm
    const { data: campaign } = await supabase.from('campaigns').select('gm_id').eq('id', campaignId).single()

    const { data: membership } = await supabase
      .from('campaign_members')
      .select('role')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)
      .single()

    const isOwner = campaign?.gm_id === user.id
    const isCoGM = membership?.role === 'co-gm'

    if (!isOwner && !isCoGM) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Ensure mission type belongs to campaign
    const { data: mt } = await supabase.from('mission_types').select('id,campaign_id').eq('id', id).single()
    if (!mt || mt.campaign_id !== campaignId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Prevent deletion if jobs reference this mission type
    const { data: referencingJobs } = await supabase.from('jobs').select('id').eq('mission_type_id', id).limit(1)
    if (referencingJobs && referencingJobs.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete mission type: one or more jobs reference it. Reassign or delete those jobs first.' },
        { status: 409 }
      )
    }

    const { error } = await supabase.from('mission_types').delete().eq('id', id)
    if (error) {
      console.error('Failed to delete mission type:', error)
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE mission-types error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const params = await context.params
    const campaignId = params.id

    const body = await request.json()
    const CreateSchema = z.object({
      name: z.string().min(1).max(200),
      description: z.string().optional().nullable(),
      tags: z.array(z.string()).optional().nullable(),
    })

    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })

    // Permission: campaign owner or co-gm
    const { data: campaign } = await supabase.from('campaigns').select('gm_id').eq('id', campaignId).single()

    const { data: membership } = await supabase
      .from('campaign_members')
      .select('role')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)
      .single()

    const isOwner = campaign?.gm_id === user.id
    const isCoGM = membership?.role === 'co-gm'

    if (!isOwner && !isCoGM) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: inserted, error } = await supabase
      .from('mission_types')
      .insert({
        campaign_id: campaignId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        tags: parsed.data.tags ?? null,
      })
      .select()

    if (error) {
      console.error('Failed to create mission type:', error)
      return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
    }

    return NextResponse.json(inserted?.[0] ?? null, { status: 201 })
  } catch (err) {
    console.error('POST mission-types error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
