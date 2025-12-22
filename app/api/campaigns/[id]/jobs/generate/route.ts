import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateJob } from '@/lib/llm/provider'
import { buildJobPrompt } from '@/lib/llm/prompts'

interface GenerateJobRequest {
  organizationId?: string | null
  missionTypeId?: string | null
  location?: string | null
  difficulty: number
  additionalContext?: string | null
}

interface JobData {
  title: string
  description: string
  location?: string
  difficulty: number
  reward?: string
  encounters: Array<{
    encounter_type: string
    description: string
    enemies: Record<string, unknown> | null
    challenge_rating?: string
  }>
  npcs: Array<{
    name: string
    role: string
    personality?: string
    stats_block?: Record<string, unknown> | null
  }>
  gm_notes?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body: GenerateJobRequest = await request.json()
    const { organizationId, missionTypeId, location, difficulty, additionalContext } = body

    // Validate required fields
    if (!campaignId || difficulty < 1 || difficulty > 10) {
      return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 })
    }

    // Check campaign membership
    const { data: membership, error: memberError } = await supabase
      .from('campaign_members')
      .select('role')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (memberError || !membership) {
      return NextResponse.json({ error: 'Campaign not found or access denied' }, { status: 404 })
    }

    // Fetch campaign to get party level
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Fetch organization and mission type if provided
    let organization = null
    let missionType = null

    if (organizationId) {
      const { data } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .eq('campaign_id', campaignId)
        .single()
      organization = data
    }

    if (missionTypeId) {
      const { data } = await supabase
        .from('mission_types')
        .select('*')
        .eq('id', missionTypeId)
        .eq('campaign_id', campaignId)
        .single()
      missionType = data
    }

    // Build prompt for LLM (centralized)
    const prompt = buildJobPrompt({
      partyLevel: campaign.party_level,
      difficulty,
      location,
      organization,
      missionType,
      additionalContext,
    })

    // Generate job using LLM (try OpenAI first, fallback to Gemini)
    let llmResponse: unknown
    let provider: 'openai' | 'gemini' = 'openai'

    try {
      const result = await generateJob('openai', prompt, { temperature: 0.8 })
      llmResponse = result.text
      console.log('OpenAI raw response:', llmResponse)
    } catch (openaiError) {
      console.error('OpenAI generation failed, falling back to Gemini:', openaiError)
      provider = 'gemini'
      const result = await generateJob('gemini', prompt, { temperature: 0.8 })
      llmResponse = result.text
      console.log('Gemini raw response:', llmResponse)
    }

    // Parse LLM response
    let jobData: JobData
    try {
      if (typeof llmResponse === 'string') {
        // Try to extract JSON if there's extra text
        const jsonMatch = llmResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          jobData = JSON.parse(jsonMatch[0])
        } else {
          jobData = JSON.parse(llmResponse)
        }
      } else {
        jobData = llmResponse as unknown as JobData
      }
      console.log('Parsed job data:', JSON.stringify(jobData, null, 2))
    } catch (parseError) {
      console.error('Failed to parse LLM response:', parseError)
      console.error('Raw response was:', llmResponse)
      throw new Error('Failed to parse LLM response as JSON')
    }

    // Validate required fields
    if (!jobData.title || !jobData.description) {
      console.error('Missing required fields in job data:', jobData)
      throw new Error('LLM response missing required fields (title or description)')
    }

    // Insert job into database
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        campaign_id: campaignId,
        organization_id: organizationId || null,
        mission_type_id: missionTypeId || null,
        title: jobData.title,
        description: jobData.description,
        location: jobData.location || null,
        difficulty: jobData.difficulty || difficulty,
        reward: jobData.reward || null,
        status: 'active',
        gm_notes: jobData.gm_notes || null,
        llm_raw_response: jobData,
        created_by: user.id,
      })
      .select()
      .single()

    if (jobError) {
      console.error('Failed to insert job:', jobError)
      throw new Error('Failed to save job to database')
    }

    // Insert encounters
    if (jobData.encounters && jobData.encounters.length > 0) {
      const encountersToInsert = jobData.encounters.map((encounter) => ({
        job_id: job.id,
        encounter_type: encounter.encounter_type,
        description: encounter.description,
        enemies: encounter.enemies,
        challenge_rating: encounter.challenge_rating || null,
      }))

      const { error: encountersError } = await supabase
        .from('encounters')
        .insert(encountersToInsert)

      if (encountersError) {
        console.error('Failed to insert encounters:', encountersError)
      }
    }

    // Insert NPCs
    if (jobData.npcs && jobData.npcs.length > 0) {
      const npcsToInsert = jobData.npcs.map((npc) => ({
        job_id: job.id,
        name: npc.name,
        role: npc.role,
        personality: npc.personality || null,
        stats_block: npc.stats_block || null,
      }))

      const { error: npcsError } = await supabase.from('npcs').insert(npcsToInsert)

      if (npcsError) {
        console.error('Failed to insert NPCs:', npcsError)
      }
    }

    return NextResponse.json({
      jobId: job.id,
      provider,
      message: 'Job generated successfully',
    })
  } catch (error: unknown) {
    console.error('Error generating job:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error ?? 'Failed to generate job'),
      },
      { status: 500 }
    )
  }
}

// prompts are now centralized in `lib/llm/prompts.ts`
