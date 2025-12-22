export function buildJobPrompt(params: {
  partyLevel: number
  difficulty: number
  location?: string | null
  organization?: Record<string, unknown> | null
  missionType?: Record<string, unknown> | null
  additionalContext?: string | null
}): string {
  const { partyLevel, difficulty, location, organization, missionType, additionalContext } = params

  let prompt = `Generate a Starfinder 2nd Edition mission job for a party of level ${partyLevel} adventurers.

DIFFICULTY: ${difficulty}/10 (1=trivial, 5=moderate, 10=deadly)

`

  if (location) {
    prompt += `LOCATION: ${location}\n\n`
  }

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
  "location": "Specific location (e.g., 'Absalom Station', 'Akiton', 'The Drift', 'Unknown Sector')",
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
        "level": ${Math.max(1, partyLevel - 1)},
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

export default buildJobPrompt
