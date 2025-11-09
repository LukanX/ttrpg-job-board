-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('gm', 'player')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Campaigns table
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gm_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  party_level INTEGER NOT NULL DEFAULT 1 CHECK (party_level >= 1 AND party_level <= 20),
  share_code TEXT NOT NULL UNIQUE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  faction_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mission Types table
CREATE TABLE public.mission_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Jobs table
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  mission_type_id UUID REFERENCES public.mission_types(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  difficulty INTEGER NOT NULL CHECK (difficulty >= 1 AND difficulty <= 10),
  reward TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  gm_notes TEXT,
  llm_raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Encounters table
CREATE TABLE public.encounters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  encounter_type TEXT NOT NULL,
  description TEXT NOT NULL,
  enemies JSONB,
  challenge_rating INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- NPCs table
CREATE TABLE public.npcs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  personality TEXT,
  stats_block JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Votes table
CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  session_id TEXT, -- For anonymous voting
  vote_value INTEGER NOT NULL CHECK (vote_value IN (-1, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(job_id, user_id),
  UNIQUE(job_id, session_id)
);

-- Indexes for performance
CREATE INDEX idx_campaigns_gm_id ON public.campaigns(gm_id);
CREATE INDEX idx_campaigns_share_code ON public.campaigns(share_code);
CREATE INDEX idx_organizations_campaign_id ON public.organizations(campaign_id);
CREATE INDEX idx_mission_types_campaign_id ON public.mission_types(campaign_id);
CREATE INDEX idx_jobs_campaign_id ON public.jobs(campaign_id);
CREATE INDEX idx_jobs_status ON public.jobs(status);
CREATE INDEX idx_encounters_job_id ON public.encounters(job_id);
CREATE INDEX idx_npcs_job_id ON public.npcs(job_id);
CREATE INDEX idx_votes_job_id ON public.votes(job_id);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.npcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Campaigns policies
CREATE POLICY "GMs can create campaigns" ON public.campaigns
  FOR INSERT WITH CHECK (auth.uid() = gm_id);

CREATE POLICY "GMs can view their own campaigns" ON public.campaigns
  FOR SELECT USING (auth.uid() = gm_id);

CREATE POLICY "GMs can update their own campaigns" ON public.campaigns
  FOR UPDATE USING (auth.uid() = gm_id);

CREATE POLICY "GMs can delete their own campaigns" ON public.campaigns
  FOR DELETE USING (auth.uid() = gm_id);

-- Organizations policies
CREATE POLICY "GMs can manage organizations in their campaigns" ON public.organizations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = organizations.campaign_id
      AND campaigns.gm_id = auth.uid()
    )
  );

-- Mission types policies
CREATE POLICY "GMs can manage mission types in their campaigns" ON public.mission_types
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = mission_types.campaign_id
      AND campaigns.gm_id = auth.uid()
    )
  );

-- Jobs policies
CREATE POLICY "GMs can manage jobs in their campaigns" ON public.jobs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = jobs.campaign_id
      AND campaigns.gm_id = auth.uid()
    )
  );

CREATE POLICY "Players can view active jobs via share code" ON public.jobs
  FOR SELECT USING (
    status = 'active' AND
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = jobs.campaign_id
    )
  );

-- Encounters policies (inherit from jobs)
CREATE POLICY "Access encounters if can access job" ON public.encounters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = encounters.job_id
    )
  );

CREATE POLICY "GMs can manage encounters" ON public.encounters
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      JOIN public.campaigns ON campaigns.id = jobs.campaign_id
      WHERE jobs.id = encounters.job_id
      AND campaigns.gm_id = auth.uid()
    )
  );

-- NPCs policies (inherit from jobs)
CREATE POLICY "Access NPCs if can access job" ON public.npcs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = npcs.job_id
    )
  );

CREATE POLICY "GMs can manage NPCs" ON public.npcs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      JOIN public.campaigns ON campaigns.id = jobs.campaign_id
      WHERE jobs.id = npcs.job_id
      AND campaigns.gm_id = auth.uid()
    )
  );

-- Votes policies
CREATE POLICY "Anyone can vote on active jobs" ON public.votes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = votes.job_id
      AND jobs.status = 'active'
    )
  );

CREATE POLICY "Users can view all votes" ON public.votes
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own votes" ON public.votes
  FOR UPDATE USING (
    auth.uid() = user_id OR
    (auth.uid() IS NULL AND session_id IS NOT NULL)
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.mission_types
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.encounters
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.npcs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
