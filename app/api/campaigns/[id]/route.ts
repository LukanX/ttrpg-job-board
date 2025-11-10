import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const PatchCampaignSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  party_level: z.number().int().min(1).max(20),
  settings: z.any().optional(),
})

export async function PATCH(request: NextRequest, context: any) {
  try {
    const params = context?.params
    const id = params?.id
    // If params isn't provided for some reason, try to extract id from the request URL as a fallback
    const fallbackId = (request as any)?.nextUrl?.pathname?.split('/')?.pop()
    const campaignId = id ?? fallbackId
    if (!campaignId) {
      console.error('PATCH /api/campaigns/:id - missing id', { params, url: (request as any)?.nextUrl?.pathname })
      return NextResponse.json({ error: 'Campaign id missing' }, { status: 400 })
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parse = PatchCampaignSchema.safeParse(body)
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.flatten() }, { status: 400 })
    }

  const supabase = await createClient()

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check campaign membership and role
    const { data: membership, error: memberError } = await supabase
      .from('campaign_members')
      .select('role')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (memberError || !membership) {
      return NextResponse.json({ error: 'Campaign not found or access denied' }, { status: 404 })
    }

    // Only owners and co-gms can update campaigns
    if (!['owner', 'co-gm'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 })
    }

    // Fetch campaign to ensure it exists
    const { data: existingCampaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (fetchError || !existingCampaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const updatePayload: any = {
      name: parse.data.name,
      party_level: parse.data.party_level,
    }
    if (parse.data.settings !== undefined) updatePayload.settings = parse.data.settings

    const { data: updated, error: updateError } = await supabase
      .from('campaigns')
      .update(updatePayload)
      .eq('id', campaignId)
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update campaign:', updateError)
      // include payload for easier debugging in dev
      console.error('Update payload:', updatePayload, 'campaignId:', campaignId)
      return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
    }

    return NextResponse.json({ campaign: updated }, { status: 200 })
  } catch (err) {
    console.error('PATCH /api/campaigns/:id error', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
