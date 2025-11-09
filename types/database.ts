// Database types
export interface User {
  id: string
  email: string
  display_name: string | null
  role: 'gm' | 'player'
  created_at: string
  updated_at: string
}

export interface Campaign {
  id: string
  gm_id: string
  name: string
  party_level: number
  share_code: string
  settings: Record<string, any>
  created_at: string
  updated_at: string
}

export interface Organization {
  id: string
  campaign_id: string
  name: string
  description: string | null
  faction_type: string | null
  created_at: string
  updated_at: string
}

export interface MissionType {
  id: string
  campaign_id: string
  name: string
  description: string | null
  tags: string[] | null
  created_at: string
  updated_at: string
}

export interface Job {
  id: string
  campaign_id: string
  organization_id: string | null
  mission_type_id: string | null
  title: string
  description: string
  difficulty: number
  reward: string | null
  status: 'active' | 'completed' | 'archived'
  gm_notes: string | null
  llm_raw_response: Record<string, any> | null
  created_at: string
  updated_at: string
}

export interface Encounter {
  id: string
  job_id: string
  encounter_type: string
  description: string
  enemies: Record<string, any> | null
  challenge_rating: number | null
  created_at: string
  updated_at: string
}

export interface NPC {
  id: string
  job_id: string
  name: string
  role: string | null
  personality: string | null
  stats_block: Record<string, any> | null
  created_at: string
  updated_at: string
}

export interface Vote {
  id: string
  job_id: string
  user_id: string | null
  session_id: string | null
  vote_value: 1 | -1
  created_at: string
}
