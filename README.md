# Starfinder 2E Job Board

An AI-powered TTRPG mission board for Starfinder 2nd Edition. GMs can generate and manage campaign missions using LLMs, while players vote on which adventures to tackle next.

## ✨ Features

### For Game Masters
- 🎲 **AI Job Generation** - Generate Starfinder 2E missions with OpenAI (primary) or Google Gemini (fallback)
- 📋 **Campaign Management** - Create campaigns, set party levels, manage share codes
- 🏢 **Organizations & Factions** - Define quest givers and mission sources
- 🎯 **Mission Types** - Categorize missions (exploration, combat, investigation, etc.)
- 🔒 **GM Notes** - Private notes and secrets for each mission
- 📊 **Vote Tracking** - See which missions your players want to play

### For Players
- 🔗 **Share Links** - Access campaigns via unique share codes (no login required)
- 👍 **Voting System** - Upvote/downvote missions to influence the next session
- 📱 **Responsive UI** - Works on desktop and mobile
- 💾 **Anonymous or Authenticated** - Vote as a guest or sign in for persistent votes

## 🚀 Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, React 19)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL with RLS)
- **Authentication**: Supabase Auth
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **LLM APIs**: 
  - OpenAI (gpt-4o-mini) - Primary
  - Google Gemini (gemini-2.5-flash) - Fallback
- **Forms**: React Hook Form + Zod validation
- **Deployment**: Vercel-ready

## 📦 Getting Started

### Prerequisites
- Node.js 20.x or higher
- A Supabase account (free tier works)
- OpenAI API key and/or Google AI API key

### Installation

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd job-board
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**

Create a `.env.local` file in the root directory:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# LLM APIs (need at least one)
OPENAI_API_KEY=your_openai_api_key
GOOGLE_API_KEY=your_google_ai_api_key

# App
NEXT_PUBLIC_APP_URL=<your_app_url>
```

4. **Set up the database**

Run the migrations in your Supabase project:
- Go to your Supabase dashboard → SQL Editor
- Run the SQL files in `supabase/migrations/` in order

5. **Run the development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## 🎮 Usage

### As a GM

1. **Sign up** and select "Game Master" as your role
2. **Create a campaign** with a name and party level
3. **Add organizations** (quest givers like corporations, factions)
4. **Add mission types** (e.g., "Exploration", "Bounty Hunting", "Investigation")
5. **Generate jobs** using AI - select organization, mission type, and difficulty
6. **Share the link** with your players using the campaign's share code

### As a Player

1. **Visit the share link** provided by your GM (`/share/[shareCode]`)
2. **View available missions** with descriptions, rewards, and difficulty
3. **Vote** on missions you want to play (👍 upvote, 👎 downvote)
4. **See results** - net votes help the GM choose the next adventure

## 📁 Project Structure

```
job-board/
├── app/
│   ├── (auth)/              # Authentication pages
│   │   ├── login/
│   │   └── signup/
│   ├── gm/                  # GM-only routes
│   │   ├── dashboard/       # Campaign list
│   │   └── campaigns/[id]/  # Campaign detail with tabs
│   ├── share/[shareCode]/   # Player voting page
│   └── api/                 # API routes
│       ├── jobs/generate/   # LLM job generation
│       └── votes/           # Voting endpoint
├── components/
│   └── ui/                  # shadcn/ui components
├── lib/
│   ├── llm/                 # LLM provider abstraction
│   │   ├── provider.ts      # Main interface
│   │   ├── openai.ts        # OpenAI adapter
│   │   └── gemini.ts        # Gemini adapter
│   └── supabase/            # Supabase clients
├── supabase/migrations/     # Database schema
└── types/                   # TypeScript types
```

## 🗄️ Database Schema

- **users** - User accounts (GM/player roles)
- **campaigns** - Campaign metadata and share codes
- **organizations** - Quest-giving factions
- **mission_types** - Mission categories
- **jobs** - Generated missions with LLM responses
- **encounters** - Combat/exploration encounters
- **npcs** - Quest givers, allies, antagonists
- **votes** - Player votes (supports anonymous via session_id)

## 🔐 Security

- Row Level Security (RLS) on all Supabase tables
- API keys stored in environment variables (never committed)
- Server-side authentication checks
- Vote validation (one vote per user/session per job)

## 🚧 Roadmap

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for detailed next steps.

**Current Status: MVP Complete** ✅
- ✅ GM dashboard with campaign management
- ✅ AI job generation (OpenAI + Gemini fallback)
- ✅ Player share view with voting
- ✅ Anonymous and authenticated voting

**Next Steps:**
- [ ] Complete CRUD operations (edit/delete for all entities)
- [ ] Job status management (active/completed/archived)
- [ ] Enhanced job detail view with encounters/NPCs
- [ ] Vote analytics for GMs
- [ ] End-to-end testing
- [ ] Mobile UI polish
- [ ] Deployment documentation

## 📄 License

MIT

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Powered by [Supabase](https://supabase.com/)
- AI by [OpenAI](https://openai.com/) and [Google Gemini](https://ai.google.dev/)
