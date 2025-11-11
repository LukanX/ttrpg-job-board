import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Schema for validating job update requests
const PatchJobSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200).optional(),
  description: z.string().min(1, 'Description is required').optional(),
  difficulty: z.number().int().min(1).max(20).optional(),
  reward: z.string().max(500).optional().nullable(),
  status: z.enum(['active', 'completed', 'archived']).optional(),
  gm_notes: z.string().optional().nullable(),
  organization_id: z.string().uuid().optional().nullable(),
  mission_type_id: z.string().uuid().optional().nullable(),
})

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get job ID from params
    const params = await context.params
    const jobId = params.id

    // Validate request body
    const body = await request.json()
    const validationResult = PatchJobSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    // Fetch the job to check permissions
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, campaign_id, created_by')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Fetch campaign to check ownership
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('gm_id')
      .eq('id', job.campaign_id)
      .single()

    // Check permissions: user must be either:
    // 1. The creator of the job
    // 2. The campaign owner (gm_id)
    // 3. A co-GM member of the campaign
    const isCreator = job.created_by === user.id
    const isOwner = campaign?.gm_id === user.id

    // Check if user is a co-GM
    const { data: membership } = await supabase
      .from('campaign_members')
      .select('role')
      .eq('campaign_id', job.campaign_id)
      .eq('user_id', user.id)
      .single()

    const isCoGM = membership?.role === 'co-gm'

    if (!isCreator && !isOwner && !isCoGM) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to edit this job' },
        { status: 403 }
      )
    }

    // Update the job
    const { data: updatedJob, error: updateError } = await supabase
      .from('jobs')
      .update({
        ...validationResult.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating job:', updateError)
      return NextResponse.json(
        { error: 'Failed to update job' },
        { status: 500 }
      )
    }

    return NextResponse.json(updatedJob)
  } catch (error) {
    console.error('Error in PATCH /api/jobs/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = await context.params
    const jobId = params.id

    // Fetch the job to check permissions
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, campaign_id, created_by')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Fetch campaign to check ownership
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('gm_id')
      .eq('id', job.campaign_id)
      .single()

    // Permission: only the creator or the campaign owner can delete
    const isCreator = job.created_by === user.id
    const isOwner = campaign?.gm_id === user.id

    if (!isCreator && !isOwner) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to delete this job' },
        { status: 403 }
      )
    }

    // Server-side cleanup: delete dependent records first to avoid FK constraint errors.
    // Delete encounters
    const { error: encountersDeleteError } = await supabase
      .from('encounters')
      .delete()
      .eq('job_id', jobId)

    if (encountersDeleteError) {
      console.error('Error deleting encounters for job:', encountersDeleteError)
      return NextResponse.json({ error: 'Failed to delete related encounters' }, { status: 500 })
    }

    // Delete NPCs
    const { error: npcsDeleteError } = await supabase.from('npcs').delete().eq('job_id', jobId)

    if (npcsDeleteError) {
      console.error('Error deleting npcs for job:', npcsDeleteError)
      return NextResponse.json({ error: 'Failed to delete related NPCs' }, { status: 500 })
    }

    // Delete votes (if any)
    const { error: votesDeleteError } = await supabase.from('votes').delete().eq('job_id', jobId)

    if (votesDeleteError) {
      console.error('Error deleting votes for job:', votesDeleteError)
      return NextResponse.json({ error: 'Failed to delete related votes' }, { status: 500 })
    }

    // Finally delete the job itself
    const { error: deleteError } = await supabase.from('jobs').delete().eq('id', jobId)

    if (deleteError) {
      console.error('Error deleting job:', deleteError)
      const msg = deleteError.message || 'Failed to delete job'
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/jobs/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
