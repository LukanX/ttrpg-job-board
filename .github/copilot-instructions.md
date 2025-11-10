# GitHub Copilot Instructions - Starfinder 2E Job Board

## Project Overview
This is an LLM-powered job board for TTRPGs, with the MVP being focused on Starfinder 2E. GMs can manage campaigns and generate AI-powered job postings, while players can view and vote on missions via shared links.

## Task Planning and Problem Solving

- Before each task, you must first complete the following steps:
  1. Provide a full plan of your changes.
  2. Provide a list of behaviors that you'll change.
  3. Provide a list of test cases to add.
- Before you add any code, always check if you can just re-use
  or re-configure any existing code to achieve the result.


## Technology Stack

### Core Framework & Versions
- **Next.js**: 16.x (latest stable, App Router)
- **React**: 19.x (latest stable)
- **TypeScript**: 5.x (latest stable)
- **Node.js**: 20.x LTS or higher
- **Tailwind CSS**: 4.x (latest stable)
- **shadcn/ui**: Latest version for pre-built components


### Database & Backend
- **Supabase**: PostgreSQL-based backend with Auth, Realtime, and Storage
- **Supabase CLI**: For managing database schema and migrations

### Testing: Jest

**Testing Guidelines:**
- Write comprehensive unit tests for all business logic
- Follow the AAA pattern: Arrange, Act, Assert
- Maintain good test coverage (aim for 80%+ for critical paths)
- Write descriptive test names that explain the expected behavior
- Use test doubles (mocks, stubs, spies) appropriately
- Implement integration tests for API endpoints and user flows
- Keep tests fast, isolated, and deterministic
 - Use typed test helpers for common patterns (e.g., `tests/helpers/consoleSpy.ts`) to standardize mocks/spies and keep tests quiet while allowing assertions on logs
 - Prefer asserting on logged errors (with a spy) rather than only silencing them when the log is part of the behavior under test

## AI Code Generation Preferences

When generating code, please:

- Generate complete, working code examples with proper imports
- Include inline comments for complex logic and business rules
- Follow the established patterns and conventions in this project
- Suggest improvements and alternative approaches when relevant
- Consider performance, security, and maintainability
- Include error handling and edge case considerations
- Generate appropriate unit tests when creating new functions
- Follow accessibility best practices for UI components
- Use semantic HTML and proper ARIA attributes when applicable

## Project Structure

```
job-board/
├── .github/
│   └── copilot-instructions.md
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── signup/
│   ├── (gm)/
│   │   ├── dashboard/
│   │   ├── campaigns/
│   │   │   └── [id]/
│   │   │       ├── page.tsx
│   │   │       ├── organizations/
│   │   │       ├── mission-types/
│   │   │       └── jobs/
│   │   └── layout.tsx
│   ├── (player)/
│   │   └── share/
│   │       └── [shareCode]/
│   │           └── page.tsx
│   ├── api/
│   │   ├── jobs/
│   │   │   ├── generate/
│   │   │   │   └── route.ts
│   │   │   └── [id]/
│   │   │       ├── encounters/
│   │   │       └── npcs/
│   │   └── votes/
│   │       └── route.ts
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/ (shadcn components)
│   ├── gm/
│   │   ├── CampaignForm.tsx
│   │   ├── OrganizationList.tsx
│   │   ├── MissionTypeList.tsx
│   │   ├── JobCard.tsx
│   │   └── JobGenerator.tsx
│   ├── player/
│   │   ├── JobList.tsx
│   │   └── VotingButton.tsx
│   └── shared/
│       ├── Header.tsx
│       └── Footer.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── llm/
│   │   ├── prompts.ts
│   │   └── generators.ts
│   ├── utils.ts
│   └── constants.ts
├── types/
│   ├── database.ts
│   ├── campaign.ts
│   ├── job.ts
│   └── vote.ts
├── hooks/
│   ├── useCampaign.ts
│   ├── useJobs.ts
│   └── useVotes.ts
├── supabase/
│   ├── migrations/
│   └── config.toml
├── public/
├── .env.local
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── IMPLEMENTATION_PLAN.md
```

## Coding Standards & Best Practices

### TypeScript
- Use strict mode (`"strict": true` in tsconfig.json)
- Define explicit types for all function parameters and return values
- Use interfaces for object shapes, types for unions/primitives
- Avoid `any` - use `unknown` if type is truly unknown

### React & Next.js
- Use **Server Components** by default
- Add `'use client'` directive only when needed (forms, interactivity, hooks)
- Use **Server Actions** for mutations instead of API routes where appropriate
- Implement proper loading.tsx and error.tsx files
- Use Next.js Image component for all images
- Implement proper metadata for SEO

### Code Organization
- **One component per file** with clear naming
- **Co-locate related files**: keep components near their usage
- **Barrel exports**: use index.ts files for cleaner imports
- **Custom hooks**: extract reusable logic into hooks/
- **Type safety**: define all database types from Supabase schema

### Styling
- Use **Tailwind CSS** utility classes
- Use **clsx** or **cn** helper for conditional classes
- Follow mobile-first responsive design
- Use Tailwind's color palette (avoid custom colors initially)
- Implement dark mode support using Tailwind's dark: variant

### State Management
- Use **React Server Components** for server state
- Use **useState/useReducer** for local component state
- Use **React Context** for shared UI state (theme, modals)
- Use **Supabase Realtime** for live updates (votes)
- Avoid prop drilling - lift state appropriately

### Database & Supabase
- Use **Row Level Security (RLS)** for all tables
- Create migrations for schema changes
- Use Supabase client for browser, server client for API routes/server components
- Type database responses using generated types
- Handle loading and error states for all queries

### LLM Integration
- Use **streaming responses** for better UX
- Implement **rate limiting** on generation endpoints
- Cache LLM responses when appropriate
- Use **structured outputs** (JSON mode) for consistent parsing
- Handle LLM errors gracefully with fallbacks
- Store prompts in version control for reproducibility

### API Routes
- Validate all inputs using **Zod schemas**
- Return proper HTTP status codes
- Include error messages in responses
- Use TypeScript for request/response types
- Implement authentication checks

### Security
- Never expose API keys in client code
- Use environment variables for secrets
- Validate all user inputs
- Implement CORS properly
- Use Supabase RLS for authorization
- Sanitize LLM outputs before rendering

### Error Handling
- Use try-catch blocks for async operations
- Provide user-friendly error messages
- Log errors appropriately (avoid sensitive data)
- Implement error boundaries for React components
- Show loading states during async operations

### Testing (Future Phase)
- Unit tests for utility functions
- Integration tests for API routes
- E2E tests for critical user flows
- Test LLM prompts with mock responses

## Database Schema Reference

### Key Tables
- **users**: id, email, display_name, role
- **campaigns**: id, gm_id, name, party_level, share_code, settings
- **organizations**: id, campaign_id, name, description, faction_type
- **mission_types**: id, campaign_id, name, description, tags
- **jobs**: id, campaign_id, organization_id, title, description, difficulty, reward, status, gm_notes
- **encounters**: id, job_id, encounter_type, description, enemies, challenge_rating
- **npcs**: id, job_id, name, role, personality, stats_block
- **votes**: id, job_id, user_id, vote_value

## LLM Prompt Guidelines

### Job Generation Prompts
- Include party level for difficulty scaling
- Reference organizations and mission types
- Request structured JSON output
- Include Starfinder 2E specific terminology
- Ask for GM notes/secrets separately
- Ensure variety in outputs

### Encounter Generation
- Reference job context
- Scale to party level
- Include tactical considerations
- Provide stat blocks in Starfinder 2E format

### NPC Generation
- Tie to job/organization
- Include personality traits
- Provide role-appropriate stats
- Include motivations and secrets

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# LLM API
OPENAI_API_KEY=your_openai_key
# OR
GROQ_API_KEY=your_groq_key
# OR
GOOGLE_AI_API_KEY=your_gemini_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Development Workflow

1. **Start with Database**: Define Supabase schema first
2. **Generate Types**: Use Supabase CLI to generate TypeScript types
3. **Build Server Components**: Start with read-only views
4. **Add Interactivity**: Convert to Client Components as needed
5. **Implement LLM**: Add generation features incrementally
6. **Test Thoroughly**: Verify all flows work end-to-end
7. **Deploy to Vercel**: Connect GitHub repo for auto-deployments

## Phase 1 MVP Checklist

- [x] Next.js project setup with TypeScript and Tailwind
- [x] Supabase project created and schema defined
- [x] Authentication implemented (Supabase Auth)
- [ ] GM dashboard with campaign CRUD
- [ ] Organization and mission type management
- [x] LLM job generation endpoint
- [x] Share link functionality
- [x] Player view with job listing
- [x] Voting system with real-time updates
- [ ] Basic error handling and loading states

## Common Patterns

### Server Component Data Fetching
```typescript
async function getData() {
  const supabase = createServerComponentClient({ cookies })
  const { data, error } = await supabase.from('campaigns').select()
  if (error) throw error
  return data
}
```

### Client Component with Form
```typescript
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({ name: z.string().min(1) })
```

### Server Action
```typescript
'use server'
async function createCampaign(formData: FormData) {
  const supabase = createServerActionClient({ cookies })
  // ... implementation
  revalidatePath('/dashboard')
}
```

### LLM Generation
```typescript
import OpenAI from 'openai'

const completion = await openai.chat.completions.create({
  model: 'gpt-4-turbo-preview',
  response_format: { type: 'json_object' },
  messages: [...]
})
```

## Notes for Copilot

- Prioritize **Server Components** over Client Components
- Use **TypeScript** strictly - no implicit any
- Follow **App Router** conventions (not Pages Router)
- Implement **proper error boundaries** and loading states
- Keep costs low - use efficient LLM calls
- Focus on **MVP features** first before advanced functionality
- Make code **modular and reusable**
- Write **self-documenting code** with clear names
- Add **JSDoc comments** for complex functions
- Consider **accessibility** (ARIA labels, keyboard navigation)
