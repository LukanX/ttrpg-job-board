# AI Rules for Starfinder 2E Job Board

This is an LLM-powered job board for TTRPGs, with the MVP being focused on Starfinder 2E. GMs can manage campaigns and generate AI-powered job postings, while players can view and vote on missions via shared links.

## CODING_PRACTICES

## Task Planning and Problem Solving

- Before each task, you must first complete the following steps:
  1. Provide a full plan of your changes.
  2. Provide a list of behaviors that you'll change.
  3. Provide a list of test cases to add.
- Before you add any code, always check if you can just re-use
  or re-configure any existing code to achieve the result.


### Guidelines for SUPPORT_LEVEL

#### SUPPORT_BEGINNER

- When running in agent mode, execute up to 3 actions at a time and ask for approval or course correction afterwards.
- Write code with clear variable names and include explanatory comments for non-obvious logic. Avoid shorthand syntax and complex patterns.
- Provide full implementations rather than partial snippets. Include import statements, required dependencies, and initialization code.
- Add defensive coding patterns and clear error handling. Include validation for user inputs and explicit type checking.
- Suggest simpler solutions first, then offer more optimized versions with explanations of the trade-offs.
- Briefly explain why certain approaches are used and link to relevant documentation or learning resources.
- When suggesting fixes for errors, explain the root cause and how the solution addresses it to build understanding. Ask for confirmation before proceeding.
- Offer introducing basic test cases that demonstrate how the code works and common edge cases to consider.
- Consider performance, security, and maintainability


### Guidelines for VERSION_CONTROL

#### GIT

- Use conventional commits to create meaningful commit messages
- Use feature branches with descriptive names following {{branch_naming_convention}}
- Write meaningful commit messages that explain why changes were made, not just what
- Keep commits focused on single logical changes to facilitate code review and bisection
- Use interactive rebase to clean up history before merging feature branches
- Leverage git hooks to enforce code quality checks before commits and pushes

#### GITHUB

- Use pull request templates to standardize information provided for code reviews
- Implement branch protection rules for {{protected_branches}} to enforce quality checks
- Configure required status checks to prevent merging code that fails tests or linting
- Use GitHub Actions for CI/CD workflows to automate testing and deployment
- Implement CODEOWNERS files to automatically assign reviewers based on code paths
- Use GitHub Projects for tracking work items and connecting them to code changes

## FRONTEND

### Guidelines for REACT

#### REACT_CODING_STANDARDS

- Use functional components with hooks instead of class components
- Implement React.memo() for expensive components that render often with the same props
- Utilize React.lazy() and Suspense for code-splitting and performance optimization
- Use the useCallback hook for event handlers passed to child components to prevent unnecessary re-renders
- Prefer useMemo for expensive calculations to avoid recomputation on every render
- Implement useId() for generating unique IDs for accessibility attributes
- Use the new use hook for data fetching in React 19+ projects
- Leverage Server Components for {{data_fetching_heavy_components}} when using React with Next.js or similar frameworks
- Consider using the new useOptimistic hook for optimistic UI updates in forms
- Use useTransition for non-urgent state updates to keep the UI responsive

#### NEXT_JS

- Use App Router and Server Components for improved performance and SEO
- Implement route handlers for API endpoints instead of the pages/api directory
- Use server actions for form handling and data mutations from Server Components
- Leverage Next.js Image component with proper sizing for core web vitals optimization
- Implement the Metadata API for dynamic SEO optimization
- Use React Server Components for {{data_fetching_operations}} to reduce client-side JavaScript
- Implement Streaming and Suspense for improved loading states
- Use the new Link component without requiring a child <a> tag
- Leverage parallel routes for complex layouts and parallel data fetching
- Implement intercepting routes for modal patterns and nested UIs


### Guidelines for STYLING

#### TAILWIND

- Use the @layer directive to organize styles into components, utilities, and base layers
- Implement Just-in-Time (JIT) mode for development efficiency and smaller CSS bundles
- Use arbitrary values with square brackets (e.g., w-[123px]) for precise one-off designs
- Leverage the @apply directive in component classes to reuse utility combinations
- Implement the Tailwind configuration file for customizing theme, plugins, and variants
- Use component extraction for repeated UI patterns instead of copying utility classes
- Leverage the theme() function in CSS for accessing Tailwind theme values
- Implement dark mode with the dark: variant
- Use responsive variants (sm:, md:, lg:, etc.) for adaptive designs
- Leverage state variants (hover:, focus:, active:, etc.) for interactive elements

## DATABASE
- **Supabase**: PostgreSQL-based backend with Auth, Realtime, and Storage
- **Supabase CLI**: For managing database schema and migrations

### Database & Supabase
- Use **Row Level Security (RLS)** for all tables
- Create migrations for schema changes
- Use Supabase client for browser, server client for API routes/server components
- Type database responses using generated types
- Handle loading and error states for all queries

### Guidelines for SQL

#### POSTGRES

- Use connection pooling to manage database connections efficiently
- Implement JSONB columns for semi-structured data instead of creating many tables for {{flexible_data}}
- Use materialized views for complex, frequently accessed read-only data

## DEVOPS

### Guidelines for CONTAINERIZATION

#### DOCKER

- Use multi-stage builds to create smaller production images
- Implement layer caching strategies to speed up builds for {{dependency_types}}
- Use non-root users in containers for better security


### Guidelines for CI_CD

#### GITHUB_ACTIONS

- Check if `package.json` exists in project root and summarize key scripts
- Check if `.nvmrc` exists in project root
- Check if `.env.example` exists in project root to identify key `env:` variables
- Always use terminal command: `git branch -a | cat` to verify whether we use `main` or `master` branch
- Always use `env:` variables and secrets attached to jobs instead of global workflows
- Always use `npm ci` for Node-based dependency setup
- Extract common steps into composite actions in separate files
- Once you're done, as a final step conduct the following: for each public action always use <tool>"Run Terminal"</tool> to see what is the most up-to-date version (use only major version) - extract tag_name from the response:
- ```bash curl -s https://api.github.com/repos/{owner}/{repo}/releases/latest ```

## TESTING

### Guidelines for UNIT

#### JEST

- Use Jest with TypeScript for type checking in tests
- Implement Testing Library for component testing instead of enzyme
- Use snapshot testing sparingly and only for stable UI components
- Leverage mock functions and spies for isolating units of code
- Implement test setup and teardown with beforeEach and afterEach
- Use describe blocks for organizing related tests
- Leverage expect assertions with specific matchers
- Implement code coverage reporting with meaningful targets
- Use mockResolvedValue and mockRejectedValue for async testing
- Leverage fake timers for testing time-dependent functionality

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

## Coding Standards
### Code Organization
- **One component per file** with clear naming
- **Co-locate related files**: keep components near their usage
- **Barrel exports**: use index.ts files for cleaner imports
- **Custom hooks**: extract reusable logic into hooks/
- **Type safety**: define all database types from Supabase schema

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
## Development Workflow

1. **Start with Database**: Define Supabase schema first
2. **Generate Types**: Use Supabase CLI to generate TypeScript types
3. **Build Server Components**: Start with read-only views
4. **Add Interactivity**: Convert to Client Components as needed
5. **Implement LLM**: Add generation features incrementally
6. **Test Thoroughly**: Verify all flows work end-to-end
7. **Deploy to Vercel**: Connect GitHub repo for auto-deployments


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
