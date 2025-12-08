function buildJobPrompt(params) {
  const { partyLevel, difficulty, organization, missionType, additionalContext } = params

  let prompt = `Generate a Starfinder 2nd Edition mission job for a party of level ${partyLevel} adventurers.\n\nDIFFICULTY: ${difficulty}/10 (1=trivial, 5=moderate, 10=deadly)\n\n`

  if (organization && typeof organization === 'object') {
    const org = organization
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
    const mt = missionType
    const mtName = typeof mt.name === 'string' ? mt.name : 'Mission'
    prompt += `MISSION TYPE: ${mtName}`
    if (typeof mt.description === 'string' && mt.description) {
      prompt += `\n${mt.description}`
    }
    if (Array.isArray(mt.tags) && mt.tags.length > 0) {
      const tags = mt.tags.filter((t) => typeof t === 'string')
      if (tags.length > 0) prompt += `\nTags: ${tags.join(', ')}`
    }
    prompt += '\n\n'
  }

  if (additionalContext) {
    prompt += `ADDITIONAL CONTEXT:\n${additionalContext}\n\n`
  }

  prompt += `Generate a complete mission job with the following structure (return as JSON):\n\n{\n  "title": "Engaging mission title",\n  "description": "Detailed mission description (2-3 paragraphs) that includes the situation, objectives, and stakes. Make it exciting and specific to Starfinder 2E themes (space exploration, alien cultures, technology, etc.)",\n  "difficulty": ${difficulty},\n  "reward": "Appropriate monetary reward in credits and/or other rewards",\n  "encounters": [\n    {\n      "encounter_type": "combat|social|exploration|hazard",\n      "description": "Detailed encounter description",\n      "enemies": {\n        "creatures": ["List of enemies with approximate levels"],\n        "tactics": "How enemies fight or interact"\n      },\n      "challenge_rating": "APL+X notation (e.g., 'APL+2' for party level ${partyLevel})"\n    }\n  ],\n  "npcs": [\n    {\n      "name": "NPC name",\n      "role": "contact|ally|antagonist|quest_giver|bystander",\n      "personality": "Brief personality description",\n      "stats_block": {\n        "level": ${Math.max(1, partyLevel - 1)},\n        "class": "Appropriate Starfinder 2E class",\n        "notable_abilities": ["Key abilities or traits"]\n      }\n    }\n  ],\n  "gm_notes": "Secret information, plot twists, or alternative outcomes that only the GM should know"\n}\n\nREQUIREMENTS:\n- Scale encounters appropriately for level ${partyLevel} party\n- Include 2-4 encounters of varied types\n- Include 2-3 interesting NPCs\n- Use Starfinder 2E terminology, species, and themes\n- Make the mission engaging and story-rich\n- Difficulty ${difficulty}/10 should be reflected in encounter CRs and complexity\n- Return ONLY valid JSON, no additional text\n\nGenerate the mission now:`

  return prompt
}

const sample = buildJobPrompt({
  partyLevel: 5,
  difficulty: 6,
  organization: { name: 'Veskarium', faction_type: 'Government', description: 'Galactic government faction with strict protocols.' },
  missionType: { name: 'Recon', description: 'Stealthy reconnaissance mission.', tags: ['stealth', 'espionage'] },
  additionalContext: 'Include a twist where the NPC betrays the party.'
})

console.log(sample)
