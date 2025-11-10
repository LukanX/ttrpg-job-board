import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateJob } from '@/lib/llm/provider'

interface GenerateJobRequest {
  campaignId: string
  organizationId?: string | null
  missionTypeId?: string | null
  difficulty: number
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
    enemies: any
    challenge_rating?: string
  }>
  npcs: Array<{
    name: string
    role: string
    personality?: string
    stats_block?: any
  }>
  gm_notes?: string
}

export async function POST(request: NextRequest) {
  try {
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
    const { campaignId, organizationId, missionTypeId, difficulty, additionalContext } = body

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

    // Build prompt for LLM
    const prompt = buildJobPrompt({
      partyLevel: campaign.party_level,
      difficulty,
      organization,
      missionType,
      additionalContext,
    })

    // Generate job using LLM (try OpenAI first, fallback to Gemini)
    let llmResponse: any
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
        jobData = llmResponse
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
  } catch (error) {
    console.error('Error generating job:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate job',
      },
      { status: 500 }
    )
  }
}

function buildJobPrompt(params: {
  partyLevel: number
  difficulty: number
  organization?: any
  missionType?: any
  additionalContext?: string | null
}): string {
  const { partyLevel, difficulty, organization, missionType, additionalContext } = params

  let prompt = `Generate a Starfinder 2nd Edition mission job for a party of level ${partyLevel} adventurers.

DIFFICULTY: ${difficulty}/10 (1=trivial, 5=moderate, 10=deadly)

`

  if (organization) {
    prompt += `ORGANIZATION: ${organization.name}`
    if (organization.faction_type) {
      prompt += ` (${organization.faction_type})`
    }
    if (organization.description) {
      prompt += `\n${organization.description}`
    }
    prompt += '\n\n'
  }

  if (missionType) {
    prompt += `MISSION TYPE: ${missionType.name}`
    if (missionType.description) {
      prompt += `\n${missionType.description}`
    }
    if (missionType.tags && missionType.tags.length > 0) {
      prompt += `\nTags: ${missionType.tags.join(', ')}`
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
