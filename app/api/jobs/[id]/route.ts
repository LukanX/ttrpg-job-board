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
