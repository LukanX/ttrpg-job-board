import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// Schema for updating character assignment
const UpdateCharacterSchema = z.object({
  characterName: z.string().max(100).nullable(),
})

// No service-role client here: rely on DB RLS + trigger to allow a member
// to update only their own character_name. This avoids using the service
// key and enforces auth at the database layer.

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

    // Update using the session-bound server client. With the RLS policy and
    // trigger in place, the DB will allow the update only when
    // user_id = auth.uid() and will prevent changes to sensitive columns.
    const { data: updated, error: updateError } = await supabase
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
