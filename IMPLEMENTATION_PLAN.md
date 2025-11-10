# Starfinder 2E LLM-Powered Job Board - Implementation Plan

## Project Overview
A web application that generates TTRPG job postings using AI, allowing GMs to manage campaigns and players to view/vote on missions.

**Current Status**: MVP Phase Complete ✅

---

## ✅ Completed Features

### Phase 1: MVP Foundation (COMPLETE)

#### ✅ Database & Infrastructure
- ✅ Supabase project setup with PostgreSQL
- ✅ Complete database schema (8 tables with RLS policies)
  - users, campaigns, organizations, mission_types
  - jobs, encounters, npcs, votes
- ✅ Database migrations in version control
- ✅ Row Level Security (RLS) policies for data protection
- ✅ Indexes for performance optimization

#### ✅ Authentication System
- ✅ Supabase Auth integration
- ✅ Email/password signup and login
- ✅ Role-based access (GM/Player)
- ✅ Protected routes with middleware (proxy.ts)
- ✅ Server-side authentication checks

#### ✅ LLM Integration
- ✅ Provider abstraction layer (`lib/llm/provider.ts`)
- ✅ OpenAI adapter (gpt-4o-mini primary)
- ✅ Google Gemini adapter (gemini-2.5-flash fallback)
- ✅ JSON mode for structured responses
- ✅ Automatic fallback on provider failure
- ✅ Prompt engineering for Starfinder 2E missions

#### ✅ GM Dashboard
- ✅ Campaign listing page
- ✅ Campaign creation with nanoid share codes
- ✅ Campaign detail page with tabbed interface
- ✅ Organizations tab (create, list)
- ✅ Mission Types tab (create, list with tags)
- ✅ Jobs tab (list, generate button)

#### ✅ AI Job Generation
- ✅ Job generation form (select org, mission type, difficulty)
- ✅ LLM API route (`/api/jobs/generate`)
- ✅ Contextual prompt building (party level, orgs, types)
- ✅ Structured output (title, description, encounters, NPCs, GM notes)
- ✅ Database persistence (jobs, encounters, npcs)
- ✅ Job detail page with full encounter/NPC display

#### ✅ Player Share View
- ✅ Public share page (`/share/[shareCode]`)
- ✅ Display active jobs with descriptions
- ✅ Voting system (upvote/downvote)
- ✅ Anonymous voting (session-based)
- ✅ Authenticated voting (user-based)
- ✅ Real-time vote count display
- ✅ Optimistic UI updates
- ✅ Vote API endpoint (`/api/votes`)

#### ✅ UI/UX Basics
- ✅ Tailwind CSS styling
- ✅ Responsive design (mobile-friendly)
- ✅ Loading states
- ✅ Error handling and display
- ✅ Form validation (React Hook Form + Zod)

---

## 🚧 Phase 2: Enhanced Features (NEXT STEPS)

### Priority 1: Complete CRUD Operations

#### 1.1 Campaign Management
- ✅ Edit campaign (name, party level)
- [ ] Delete campaign (with confirmation)
- [ ] Archive/restore campaigns
- [ ] Campaign settings page
 - [ ] Campaign member management UI (invite / remove / change roles for co-GMs)
   - Create `components/gm/CampaignMembers.tsx` (client component)
   - Wire into `app/gm/campaigns/[id]/page.tsx` and gate visibility to owners/co-GMs
   - Features: list members, invite by email, change role, remove member, confirmation modal
   - Acceptance: owners can invite/change/remove members; non-members cannot see controls
   - Estimated effort: 3-6 hours (MVP)

#### 1.2 Organizations
- [ ] Edit organization details
- [ ] Delete organization (check for dependent jobs)
- [ ] Organization detail view
- [ ] Track jobs per organization

#### 1.3 Mission Types
- [ ] Edit mission type
- [ ] Delete mission type (check dependencies)
- [ ] Add/remove tags dynamically

#### 1.4 Jobs Management
- ✅ Edit job (title, description, status)
- [ ] Delete job (cascade to encounters/NPCs)
- ✅ Change job status (active → completed → archived)
- [ ] Regenerate job with LLM
- [ ] Manual job creation (without LLM)
- [ ] Bulk job operations

### Priority 2: GM Tools & Analytics

#### 2.1 Vote Analytics
- [ ] Vote summary on GM dashboard
- [ ] Most popular jobs highlighting
- [ ] Vote history tracking
- [ ] Export vote data

#### 2.2 Job Organization
- [ ] Filter jobs by status, organization, type
- [ ] Search jobs by title/description
- [ ] Sort by votes, date, difficulty
- [ ] Pagination for large job lists

#### 2.3 Enhanced Job Details
- [ ] Better encounter display (stats formatting)
- [ ] NPC stat block improvements
- [ ] Print-friendly view for GMs
- [ ] Job difficulty indicators

### Priority 3: Player Experience

#### 3.1 Player Features
- [ ] Job search/filter on player view
- [ ] Sort by votes, difficulty, reward
- [ ] Vote history (if authenticated)
- [ ] Comments on jobs (optional)

#### 3.2 Anonymous User Improvements
- [ ] Prompt to sign up for persistent votes
- [ ] Session vote migration on signup
- [ ] Better onboarding for new players

### Priority 4: Testing & Quality

#### 4.1 End-to-End Testing
- [ ] GM flow: signup → create campaign → generate job
- [ ] Player flow: visit share link → vote → see results
- [ ] LLM fallback testing
- [ ] Error scenarios (network failures, invalid data)
- [ ] Vote conflict resolution

#### 4.2 Unit Testing
- [ ] LLM provider abstraction tests
- [ ] API route tests
- [ ] Database query tests
- [ ] Utility function tests
 - [ ] Membership & permission tests
   - Unit tests for `app/api/campaigns/[id]/members/route.ts` (GET/POST/PATCH/DELETE)
   - Integration tests for permission semantics (owner vs co-gm vs non-member) across campaign/job endpoints
   - UI tests for `components/gm/CampaignMembers.tsx` (render, invite, change role, remove)
   - Estimated effort: 2-4 hours for initial coverage

#### 4.3 Performance
- [ ] Database query optimization
- [ ] LLM response caching
- [ ] Rate limiting on job generation
- [ ] Image optimization (if added)

---

## 🔮 Phase 3: Advanced Features (FUTURE)

### 3.1 Enhanced AI Generation
- [ ] Custom prompt templates
- [ ] Setting-specific tweaks (not just Starfinder)
- [ ] Multiple job generation (batch)
- [ ] AI plot twist generator
- [ ] Session recap generator

### 3.2 Campaign Progression
- [ ] Mark jobs as completed
- [ ] Track campaign timeline
- [ ] Recurring NPCs/factions
- [ ] Organization reputation system
- [ ] XP/level recommendations

### 3.3 Collaboration Features
- [ ] Co-GM support (multiple GMs per campaign)
- [ ] Player accounts with profiles
- [ ] Session notes shared with party
- [ ] Character integration (link players to characters)

### 3.4 Import/Export
- [ ] Export campaign as JSON
- [ ] Import campaign data
- [ ] Share job templates
- [ ] Community job library (optional)

### 3.5 Customization
- [ ] Theme preferences (dark mode, colors)
- [ ] Custom mission type icons
- [ ] Campaign branding (logo, colors)
- [ ] Email notifications (optional)

---

## 🛠️ Technical Debt & Improvements

### Code Quality
- [ ] Add comprehensive error boundaries
- [ ] Improve TypeScript type coverage
- [ ] Refactor repeated UI patterns into reusable components
- [ ] Add JSDoc comments for complex functions
- [ ] Code splitting for better performance

### Database
- [ ] Apply vote constraints migration (`20251108000003_fix_votes_constraints.sql`)
- [ ] Add database indexes for common queries
- [ ] Implement database backups
- [ ] Add soft delete for important entities
 - [ ] Add invitation expiry and cleanup: add an `expires_at` column to `campaign_invitations`, set sensible defaults (e.g., 30 days), and add a scheduled cleanup job or retention policy to remove/archive expired invites.

### Security
- [ ] Rate limiting on API routes
- [ ] CSRF protection
- [ ] Input sanitization for LLM outputs
- [ ] Audit RLS policies
- [ ] API key rotation strategy

### Deployment
- [ ] Create deployment guide
- [ ] Environment variable documentation
- [ ] Production database setup guide
- ✅ Netlify deployment configuration
- [ ] CI/CD pipeline (GitHub Actions)

---

## 📊 Current Architecture

### Technology Stack (Implemented)
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript 5
- **Styling**: Tailwind CSS 4
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **LLM**: OpenAI (gpt-4o-mini) + Google Gemini (fallback)
- **Forms**: React Hook Form + Zod
- **State**: React useState/useEffect (no global state yet)

### API Routes
- `POST /api/jobs/generate` - Generate jobs with LLM
- `POST /api/votes` - Submit/update/delete votes
- `POST /api/auth/create-profile` - User profile creation

### Key Components
- `CampaignTabs` - Tabbed interface for campaign management
- `JobsTab` - Job listing with generation button
- `OrganizationsTab` - Organization CRUD
- `MissionTypesTab` - Mission type CRUD
- `JobVotingCard` - Player voting interface

---

## 💰 Cost Considerations

### Current Monthly Costs (Hobby Use)
- **Hosting**: $0 (Vercel free tier)
- **Database**: $0 (Supabase free tier, 500MB)
- **LLM API**: ~$1-5 (light usage with gpt-4o-mini)
- **Total**: $1-5/month ✅

### Scaling Costs (If Needed)
- Vercel Pro: $20/month (advanced features)
- Supabase Pro: $25/month (higher limits)
- LLM costs scale with usage (consider caching)

---

## 🎯 Immediate Next Steps (Priority Order)

1. **Apply database migration** for vote constraints
2. **Complete CRUD operations** for campaigns, organizations, mission types
3. **Add job editing** (status changes, regeneration)
4. **Implement filtering/search** on jobs tab
5. **End-to-end testing** of full GM → player flow
6. **Vote analytics** for GM dashboard
7. **Mobile UI polish** (ensure all pages work on phones)
8. **Deployment documentation** for Vercel
9. **Error handling improvements** (better user feedback)
10. **Performance optimization** (database query caching)

---

## 📝 Notes

- The current implementation is production-ready for MVP use
- Free tier stack can support 10-20 active campaigns easily
- LLM responses are cached in the database (llm_raw_response field)
- All database tables have proper indexes and RLS policies
- Authentication is handled entirely by Supabase (no custom auth code)
