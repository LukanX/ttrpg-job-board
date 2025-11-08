# Starfinder 2E LLM-Powered Job Board - Implementation Plan

## Project Overview
A web application that generates TTRPG job postings using AI, allowing GMs to manage campaigns and players to view/vote on missions.

---

## Technology Stack Recommendations

### Frontend
- **Framework**: Next.js 16+ (App Router)
- **UI Library**: React 19+
- **Styling**: Tailwind CSS
- **State Management**: React Context API + useState/useReducer (keep it simple initially)
- **Forms**: React Hook Form + Zod for validation

### Backend
- **API**: Next.js API Routes (serverless functions)
- **Database**: 
  - **Primary Choice**: Supabase (PostgreSQL)
    - Free tier: 500MB database, 1GB file storage
    - Built-in authentication
    - Real-time subscriptions (for voting updates)
    - Row Level Security (RLS) for data protection
  - **Alternative**: PlanetScale (MySQL) or Neon (PostgreSQL)

### LLM Integration
- **Primary Choice**: OpenAI API (GPT-4 or GPT-3.5-turbo)
  - Pay-as-you-go (cheap for hobby use)
  - Excellent structured output
- **Free Alternatives**:
  - Google Gemini API (free tier available)
  - Anthropic Claude (limited free tier)
  - Groq (free tier with fast inference)
  - Together.ai (free credits initially)

### Authentication
- **Supabase Auth** (free, includes):
  - Email/password
  - Magic links
  - OAuth (Google, GitHub, etc.)
  - Built into Supabase if using their database

### Hosting
- **Frontend/API**: Vercel (Next.js creators)
  - Free tier: unlimited personal projects
  - Automatic deployments from Git
  - Edge functions support
- **Alternative**: Netlify (similar free tier)

---

## Database Schema

### Core Tables

#### users
- id, email, display_name, role (GM/player)
- created_at, updated_at

#### campaigns
- id, gm_id (FK to users)
- name, description
- party_level (integer)
- share_code (unique string for player access)
- settings (JSON: theme preferences, etc.)
- created_at, updated_at

#### organizations
- id, campaign_id (FK)
- name, description, faction_type
- reputation_level
- created_at

#### mission_types
- id, campaign_id (FK)
- name, description
- tags (array: combat, exploration, social, etc.)

#### jobs
- id, campaign_id, organization_id (FK)
- title, description, mission_type
- difficulty, reward, location
- gm_notes (private)
- status (available, in_progress, completed, rejected)
- generated_at
- llm_prompt_used (for regeneration)

#### encounters (GM view only)
- id, job_id (FK)
- encounter_type, description
- enemies, tactics, terrain
- challenge_rating

#### npcs
- id, job_id (FK)
- name, role, personality
- stats_block (JSON)
- importance (major/minor)

#### votes
- id, job_id, user_id (FK)
- vote_value (upvote/downvote or 1-5 rating)
- created_at

---

## Key Features & Implementation

### Phase 1: MVP (Minimum Viable Product)

#### 1. GM Dashboard
- Create/manage campaign
- Add organizations and mission types
- Set party level
- Generate jobs via LLM (single button)
- View generated jobs with GM-only details
- Manual job editing

#### 2. Player View
- Access via share link (no login initially)
- View available jobs (limited details)
- Vote on preferred missions
- See vote tallies

#### 3. LLM Job Generation
- Prompt engineering for Starfinder 2E theme
- Input: organizations, mission types, party level
- Output: 3-5 job postings with structured data
- Use JSON mode for structured responses

### Phase 2: Enhanced GM Tools

#### 4. Encounter Builder
- Generate encounters for selected job
- Enemy stat blocks
- Tactical considerations
- Environmental hazards

#### 5. NPC Generator
- Create quest givers, contacts, antagonists
- Personality traits, motivations
- Basic stat blocks

#### 6. Plot Beat Generator
- Story arc suggestions
- Twist ideas
- Complication generators

### Phase 3: Polish & Advanced Features

#### 7. Campaign Management
- Job history
- Track completed missions
- Organization reputation system
- Recurring NPCs/factions

#### 8. Customization
- Custom prompt templates
- Setting-specific tweaks
- Import/export campaigns

#### 9. Collaboration
- Player accounts (optional)
- Comments on jobs
- Session notes

---

## LLM Prompt Strategy

### Job Generation Prompt Structure

```
System: You are a Starfinder 2E game master creating job postings...

Context:
- Party Level: {level}
- Organizations: {org_list}
- Mission Types: {type_list}
- Previous Jobs: {recent_jobs} (for variety)

Task: Generate 3-5 diverse job postings in JSON format with:
- title, employer, mission_type, difficulty, reward, brief_description, 
  location, time_sensitivity, gm_notes (secrets/twists)

Ensure: Varied difficulty, different organizations, Starfinder 2E themes
```

---

## Cost Estimation (Monthly)

### Free Tier
- Vercel hosting: $0
- Supabase: $0 (up to 500MB DB)
- LLM API: ~$1-5 (light usage, GPT-3.5-turbo)
- **Total: $1-5/month**

### Paid Scaling (if needed)
- Vercel Pro: $20/month (only if you need more)
- Supabase Pro: $25/month (only at scale)
- LLM costs scale with usage

---

## Development Phases

### Phase 1 (2-3 weeks): Core MVP
- Next.js setup with Tailwind
- Supabase integration
- Basic CRUD for campaigns, orgs, mission types
- LLM job generation (simple)
- Share link functionality
- Basic voting

### Phase 2 (2 weeks): GM Enhancement
- Encounter generation
- NPC generation
- Improved UI/UX
- Job editing/regeneration

### Phase 3 (1-2 weeks): Polish
- Authentication refinement
- Mobile responsiveness
- Error handling
- Loading states
- Tutorial/onboarding

---

## Technical Considerations

1. **Rate Limiting**: Implement on LLM calls to prevent abuse
2. **Caching**: Cache LLM responses to reduce costs
3. **Error Handling**: Graceful failures if LLM unavailable
4. **Security**: 
   - RLS in Supabase for data isolation
   - Validate share codes server-side
   - Sanitize LLM outputs
5. **Performance**: 
   - Streaming LLM responses for better UX
   - Optimistic UI updates for voting

---

## Alternative Free LLM Options

If you want to avoid OpenAI costs entirely:
- **Groq**: Free tier, very fast inference (Llama 3, Mixtral)
- **Together.ai**: Free credits, various open models
- **Ollama**: Self-hosted (requires your own server/computer)
- **Google Gemini**: Generous free tier

---

## Recommended Starting Point

1. Set up Next.js project with Tailwind
2. Create Supabase project and define schema
3. Build basic GM dashboard (CRUD operations)
4. Integrate LLM for job generation (start with Groq or Gemini free tier)
5. Create share link + player view
6. Add voting functionality
7. Iterate and expand

---

## Notes

This plan keeps costs minimal while providing a solid foundation for expansion. The entire stack can run on free tiers initially, only requiring LLM API costs which should be $1-5/month for hobby use.
