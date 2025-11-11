import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Vote } from '@/types/database'

interface VoteRequest {
  jobId: string
  voteValue: 0 | 1 | -1
  sessionId?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body: VoteRequest = await request.json()
    const { jobId, voteValue, sessionId } = body

    // Validate input
    if (!jobId || ![0, 1, -1].includes(voteValue)) {
      return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 })
    }

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Ensure we have either a user or session ID
    if (!user && !sessionId) {
      return NextResponse.json({ error: 'User or session ID required' }, { status: 401 })
    }

    // Verify job exists
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, campaign_id')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // If removing vote (voteValue === 0)
    if (voteValue === 0) {
      if (user) {
        // Delete authenticated user's vote
        await supabase.from('votes').delete().eq('job_id', jobId).eq('user_id', user.id)
      } else if (sessionId) {
        // Delete anonymous vote
        await supabase.from('votes').delete().eq('job_id', jobId).eq('session_id', sessionId)
      }

      return NextResponse.json({ success: true, message: 'Vote removed' })
    }

    // First, check if a vote already exists
    let existingVote: { id: string } | null = null
    if (user) {
      const { data } = await supabase
        .from('votes')
        .select('id')
        .eq('job_id', jobId)
        .eq('user_id', user.id)
        .single()
      existingVote = data
    } else if (sessionId) {
      const { data } = await supabase
        .from('votes')
        .select('id')
        .eq('job_id', jobId)
        .eq('session_id', sessionId)
        .single()
      existingVote = data
    }

    let voteError: unknown
    if (existingVote) {
      // Update existing vote
      const { error } = await supabase
        .from('votes')
        .update({ vote_value: voteValue })
        .eq('id', existingVote.id)
      voteError = error
    } else {
      // Insert new vote
      // voteValue is guaranteed to be 1 or -1 here (we returned earlier if 0)
      const voteData: Pick<Vote, 'job_id' | 'vote_value'> & Partial<Pick<Vote, 'user_id' | 'session_id'>> = {
        job_id: jobId,
        vote_value: voteValue as 1 | -1,
      }

      if (user) voteData.user_id = user.id
      else if (sessionId) voteData.session_id = sessionId

      const { error } = await supabase.from('votes').insert(voteData)
      voteError = error
    }

    if (voteError) {
      console.error('Error upserting vote:', voteError)
      return NextResponse.json({ error: 'Failed to save vote' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Vote recorded' })
  } catch (error) {
    console.error('Error processing vote:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to process vote',
      },
      { status: 500 }
    )
  }
}
