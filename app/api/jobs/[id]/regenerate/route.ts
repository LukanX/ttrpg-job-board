import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateJob } from '@/lib/llm/provider'

interface RegenerateJobRequest {
  difficulty?: number
  organizationId?: string | null
  missionTypeId?: string | null
  additionalContext?: string | null
}

interface JobData {
  title: string
  description: string
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
    const { id: jobId } = await params
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch existing job
    const { data: existingJob, error: jobError } = await supabase
      .from('jobs')
      .select('*, campaigns!inner(id, gm_id, party_level)')
      .eq('id', jobId)
      .single()

    if (jobError || !existingJob) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const campaign = existingJob.campaigns

    // Check permissions - must be job creator, campaign owner, or co-GM
    const { data: membership } = await supabase
      .from('campaign_members')
      .select('role')
      .eq('campaign_id', campaign.id)
      .eq('user_id', user.id)
      .single()

    const isCreator = existingJob.created_by === user.id
    const isOwner = campaign.gm_id === user.id
    const isCoGM = membership?.role === 'co-gm'

    if (!isCreator && !isOwner && !isCoGM) {
      return NextResponse.json(
        { error: 'You do not have permission to regenerate this job' },
        { status: 403 }
      )
    }

    // Parse request body (optional overrides)
    const body: RegenerateJobRequest = await request.json()
    const {
      difficulty = existingJob.difficulty,
      organizationId = existingJob.organization_id,
      missionTypeId = existingJob.mission_type_id,
      additionalContext = null,
    } = body

    // Validate difficulty
    if (difficulty < 1 || difficulty > 10) {
      return NextResponse.json({ error: 'Invalid difficulty (must be 1-10)' }, { status: 400 })
    }

    // Fetch organization and mission type if provided
    let organization = null
    let missionType = null

    if (organizationId) {
      const { data } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .eq('campaign_id', campaign.id)
        .single()
      organization = data
    }

    if (missionTypeId) {
      const { data } = await supabase
        .from('mission_types')
        .select('*')
        .eq('id', missionTypeId)
        .eq('campaign_id', campaign.id)
        .single()
      missionType = data
    }

    // Build prompt for LLM (reuse logic from generate route)
    const prompt = buildJobPrompt({
      partyLevel: campaign.party_level,
      difficulty,
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
      console.log('OpenAI raw response for regeneration:', llmResponse)
    } catch (openaiError) {
      console.error('OpenAI generation failed, falling back to Gemini:', openaiError)
      provider = 'gemini'
      const result = await generateJob('gemini', prompt, { temperature: 0.8 })
      llmResponse = result.text
      console.log('Gemini raw response for regeneration:', llmResponse)
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
      console.log('Parsed regenerated job data:', JSON.stringify(jobData, null, 2))
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

    // Delete existing encounters and NPCs
    const [encountersDeleteResult, npcsDeleteResult] = await Promise.all([
      supabase.from('encounters').delete().eq('job_id', jobId),
      supabase.from('npcs').delete().eq('job_id', jobId),
    ])

    if (encountersDeleteResult.error) {
      console.error('Failed to delete encounters:', encountersDeleteResult.error)
    }
    if (npcsDeleteResult.error) {
      console.error('Failed to delete NPCs:', npcsDeleteResult.error)
    }

    // Update job with new data
    const { error: updateError } = await supabase
      .from('jobs')
      .update({
        organization_id: organizationId || null,
        mission_type_id: missionTypeId || null,
        title: jobData.title,
        description: jobData.description,
        difficulty: jobData.difficulty || difficulty,
        reward: jobData.reward || null,
        gm_notes: jobData.gm_notes || null,
        llm_raw_response: jobData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    if (updateError) {
      console.error('Failed to update job:', updateError)
      throw new Error('Failed to update job in database')
    }

    // Insert new encounters
    if (jobData.encounters && jobData.encounters.length > 0) {
      const encountersToInsert = jobData.encounters.map((encounter) => ({
        job_id: jobId,
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

    // Insert new NPCs
    if (jobData.npcs && jobData.npcs.length > 0) {
      const npcsToInsert = jobData.npcs.map((npc) => ({
        job_id: jobId,
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
      jobId,
      provider,
      message: 'Job regenerated successfully',
    })
  } catch (error: unknown) {
    console.error('Error regenerating job:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error ?? 'Failed to regenerate job'),
      },
      { status: 500 }
    )
  }
}

function buildJobPrompt(params: {
  partyLevel: number
  difficulty: number
  organization?: Record<string, unknown>
  missionType?: Record<string, unknown>
  additionalContext?: string | null
}): string {
  const { partyLevel, difficulty, organization, missionType, additionalContext } = params

  let prompt = `Generate a Starfinder 2nd Edition mission job for a party of level ${partyLevel} adventurers.

DIFFICULTY: ${difficulty}/10 (1=trivial, 5=moderate, 10=deadly)

`

  if (organization && typeof organization === 'object') {
    const org = organization as Record<string, unknown>
    const name = typeof org.name === 'string' ? org.name : 'Organization'
    prompt += `ORGANIZATION: ${name}`
    if (typeof org.faction_type === 'string' && org.faction_type) {
      prompt += ` (${org.faction_type})`
    }
    if (typeof org.description === 'string' && org.description) {
      prompt += `\n${org.description}`
    }
    prompt += '\n\n'
  }

  if (missionType && typeof missionType === 'object') {
    const mt = missionType as Record<string, unknown>
    const mtName = typeof mt.name === 'string' ? mt.name : 'Mission'
    prompt += `MISSION TYPE: ${mtName}`
    if (typeof mt.description === 'string' && mt.description) {
      prompt += `\n${mt.description}`
    }
    if (Array.isArray(mt.tags) && mt.tags.length > 0) {
      const tags = mt.tags.filter((t: unknown) => typeof t === 'string') as string[]
      if (tags.length > 0) prompt += `\nTags: ${tags.join(', ')}`
    }
    prompt += '\n\n'
  }

  if (additionalContext) {
    prompt += `ADDITIONAL CONTEXT:\n${additionalContext}\n\n`
  }

  prompt += `Generate a complete mission job with the following structure (return as JSON):

{
  "title": "Engaging mission title",
  "description": "Detailed mission description (2-3 paragraphs) that includes the situation, objectives, and stakes. Make it exciting and specific to Starfinder 2E themes (space exploration, alien cultures, technology, etc.)",
  "difficulty": ${difficulty},
  "reward": "Appropriate monetary reward in credits and/or other rewards",
  "encounters": [
    {
      "encounter_type": "combat|social|exploration|hazard",
      "description": "Detailed encounter description",
      "enemies": {
        "creatures": ["List of enemies with approximate levels"],
        "tactics": "How enemies fight or interact"
      },
      "challenge_rating": "APL+X notation (e.g., 'APL+2' for party level ${partyLevel})"
    }
  ],
  "npcs": [
    {
      "name": "NPC name",
      "role": "contact|ally|antagonist|quest_giver|bystander",
      "personality": "Brief personality description",
      "stats_block": {
        "level": ${partyLevel - 1},
        "class": "Appropriate Starfinder 2E class",
        "notable_abilities": ["Key abilities or traits"]
      }
    }
  ],
  "gm_notes": "Secret information, plot twists, or alternative outcomes that only the GM should know"
}

REQUIREMENTS:
- Scale encounters appropriately for level ${partyLevel} party
- Include 2-4 encounters of varied types
- Include 2-3 interesting NPCs
- Use Starfinder 2E terminology, species, and themes
- Make the mission engaging and story-rich
- Difficulty ${difficulty}/10 should be reflected in encounter CRs and complexity
- Return ONLY valid JSON, no additional text

Generate the mission now:`

  return prompt
}
