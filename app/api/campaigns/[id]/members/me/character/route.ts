import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Schema for updating character assignment
const UpdateCharacterSchema = z.object({
  characterName: z.string().max(100).nullable(),
})

// Service role client for safe updates that bypass RLS when necessary
const getServiceClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) throw new Error('Missing Supabase service role credentials')

  return createServiceClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * PATCH /api/campaigns/[id]/members/me/character
 * Update the current user's character name for this campaign
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

    // Parse and validate request body
    const body = await request.json()
    const parse = UpdateCharacterSchema.safeParse(body)

    if (!parse.success) {
      return NextResponse.json({ error: parse.error.flatten() }, { status: 400 })
    }

    const { characterName } = parse.data

    // Use service role client to update the member row (bypass RLS safely)
    // The update is constrained by campaign_id and user_id so a user can only
    // update their own membership record.
    let serviceClient
    try {
      serviceClient = getServiceClient()
    } catch (err) {
      console.error('Failed to create service client:', err)
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { data: updated, error: updateError } = await serviceClient
      .from('campaign_members')
      .update({ character_name: characterName || null })
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)
      .select('id, character_name')
      .maybeSingle()

    if (updateError) {
      console.error('Error updating character name:', updateError)
      return NextResponse.json(
        { error: 'Failed to update character name' },
        { status: 500 }
      )
    }

    if (!updated) {
      // No row updated => user is not a member of this campaign
      return NextResponse.json(
        { error: 'You are not a member of this campaign' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      message: 'Character name updated successfully',
      characterName: updated.character_name,
    })
  } catch (err) {
    console.error('PATCH /api/campaigns/:id/members/me/character error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
