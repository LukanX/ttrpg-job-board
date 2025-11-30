-- Migration: Add campaign_members junction table for multi-GM access
-- Also adds created_by column to jobs table for creator-based permissions

-- =====================================================
-- 1. Create campaign_members junction table
-- =====================================================
CREATE TABLE IF NOT EXISTS campaign_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'co-gm' CHECK (role IN ('owner', 'co-gm', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, user_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_campaign_members_campaign ON campaign_members(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_members_user ON campaign_members(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_members_role ON campaign_members(campaign_id, role);

-- =====================================================
-- 2. Seed campaign_members with existing campaign owners
-- =====================================================
INSERT INTO campaign_members (campaign_id, user_id, role)
SELECT id, gm_id, 'owner'
FROM campaigns
WHERE gm_id IS NOT NULL
ON CONFLICT (campaign_id, user_id) DO NOTHING;

-- =====================================================
-- 3. Add created_by column to jobs table
-- =====================================================
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- Backfill existing jobs: set created_by to the campaign owner
UPDATE jobs 
SET created_by = campaigns.gm_id
FROM campaigns
WHERE jobs.campaign_id = campaigns.id
  AND jobs.created_by IS NULL;

-- Make created_by NOT NULL after backfill
ALTER TABLE jobs ALTER COLUMN created_by SET NOT NULL;

-- Add index for creator lookups
CREATE INDEX IF NOT EXISTS idx_jobs_created_by ON jobs(created_by);

-- =====================================================
-- 4. Row Level Security Policies
-- =====================================================

-- Drop old campaign policies (if they exist)
DROP POLICY IF EXISTS "Users can view their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can insert their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can update their own campaigns" ON campaigns;

-- New campaign policies: users can access campaigns they're members of
CREATE POLICY "Users can view campaigns they're members of"
ON campaigns FOR SELECT
USING (
  id IN (
    SELECT campaign_id 
    FROM campaign_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert campaigns (auto-add as owner)"
ON campaigns FOR INSERT
WITH CHECK (gm_id = auth.uid());

CREATE POLICY "Campaign owners and co-gms can update"
ON campaigns FOR UPDATE
USING (
  id IN (
    SELECT campaign_id 
    FROM campaign_members 
    WHERE user_id = auth.uid() 
      AND role IN ('owner', 'co-gm')
  )
);

CREATE POLICY "Campaign owners can delete"
ON campaigns FOR DELETE
USING (
  id IN (
    SELECT campaign_id 
    FROM campaign_members 
    WHERE user_id = auth.uid() 
      AND role = 'owner'
  )
);

-- Drop old job policies
DROP POLICY IF EXISTS "Users can view jobs for their campaigns" ON jobs;
DROP POLICY IF EXISTS "Users can insert jobs for their campaigns" ON jobs;
DROP POLICY IF EXISTS "Users can update jobs for their campaigns" ON jobs;

-- New job policies: campaign members can view, only creator (or campaign owner) can edit
CREATE POLICY "Campaign members can view jobs"
ON jobs FOR SELECT
USING (
  campaign_id IN (
    SELECT campaign_id 
    FROM campaign_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Campaign members can create jobs"
ON jobs FOR INSERT
WITH CHECK (
  campaign_id IN (
    SELECT campaign_id 
    FROM campaign_members 
    WHERE user_id = auth.uid()
  )
  AND created_by = auth.uid()
);

CREATE POLICY "Job creator can update their jobs"
ON jobs FOR UPDATE
USING (created_by = auth.uid());

CREATE POLICY "Campaign owners can update any job in their campaign"
ON jobs FOR UPDATE
USING (
  campaign_id IN (
    SELECT campaign_id 
    FROM campaign_members 
    WHERE user_id = auth.uid() 
      AND role = 'owner'
  )
);

CREATE POLICY "Job creator can delete their jobs"
ON jobs FOR DELETE
USING (created_by = auth.uid());

CREATE POLICY "Campaign owners can delete any job in their campaign"
ON jobs FOR DELETE
USING (
  campaign_id IN (
    SELECT campaign_id 
    FROM campaign_members 
    WHERE user_id = auth.uid() 
      AND role = 'owner'
  )
);

-- =====================================================
-- 5. RLS Policies for campaign_members table
-- =====================================================

ALTER TABLE campaign_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view members of their campaigns"
ON campaign_members FOR SELECT
USING (
  campaign_id IN (
    SELECT campaign_id 
    FROM campaign_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Campaign owners can manage members"
ON campaign_members FOR ALL
USING (
  campaign_id IN (
    SELECT campaign_id 
    FROM campaign_members 
    WHERE user_id = auth.uid() 
      AND role = 'owner'
  )
);

-- =====================================================
-- 6. Trigger to auto-add campaign creator as owner
-- =====================================================

CREATE OR REPLACE FUNCTION add_campaign_creator_as_owner()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO campaign_members (campaign_id, user_id, role)
  VALUES (NEW.id, NEW.gm_id, 'owner')
  ON CONFLICT (campaign_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_campaign_created ON campaigns;
CREATE TRIGGER on_campaign_created
AFTER INSERT ON campaigns
FOR EACH ROW
EXECUTE FUNCTION add_campaign_creator_as_owner();

-- =====================================================
-- 7. Similar policies for organizations and mission_types
-- =====================================================

-- Organizations: campaign members can manage
DROP POLICY IF EXISTS "Users can view organizations for their campaigns" ON organizations;
DROP POLICY IF EXISTS "Users can insert organizations for their campaigns" ON organizations;
DROP POLICY IF EXISTS "Users can update organizations for their campaigns" ON organizations;

CREATE POLICY "Campaign members can view organizations"
ON organizations FOR SELECT
USING (
  campaign_id IN (
    SELECT campaign_id 
    FROM campaign_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Campaign members can create organizations"
ON organizations FOR INSERT
WITH CHECK (
  campaign_id IN (
    SELECT campaign_id 
    FROM campaign_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Campaign owners and co-gms can update organizations"
ON organizations FOR UPDATE
USING (
  campaign_id IN (
    SELECT campaign_id 
    FROM campaign_members 
    WHERE user_id = auth.uid() 
      AND role IN ('owner', 'co-gm')
  )
);

CREATE POLICY "Campaign owners can delete organizations"
ON organizations FOR DELETE
USING (
  campaign_id IN (
    SELECT campaign_id 
    FROM campaign_members 
    WHERE user_id = auth.uid() 
      AND role = 'owner'
  )
);

-- Mission types: same pattern
DROP POLICY IF EXISTS "Users can view mission types for their campaigns" ON mission_types;
DROP POLICY IF EXISTS "Users can insert mission types for their campaigns" ON mission_types;
DROP POLICY IF EXISTS "Users can update mission types for their campaigns" ON mission_types;

CREATE POLICY "Campaign members can view mission types"
ON mission_types FOR SELECT
USING (
  campaign_id IN (
    SELECT campaign_id 
    FROM campaign_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Campaign members can create mission types"
ON mission_types FOR INSERT
WITH CHECK (
  campaign_id IN (
    SELECT campaign_id 
    FROM campaign_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Campaign owners and co-gms can update mission types"
ON mission_types FOR UPDATE
USING (
  campaign_id IN (
    SELECT campaign_id 
    FROM campaign_members 
    WHERE user_id = auth.uid() 
      AND role IN ('owner', 'co-gm')
  )
);

CREATE POLICY "Campaign owners can delete mission types"
ON mission_types FOR DELETE
USING (
  campaign_id IN (
    SELECT campaign_id 
    FROM campaign_members 
    WHERE user_id = auth.uid() 
      AND role = 'owner'
  )
);

-- =====================================================
-- 8. Helper function to check if user is campaign member
-- =====================================================

CREATE OR REPLACE FUNCTION is_campaign_member(p_campaign_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM campaign_members 
    WHERE campaign_id = p_campaign_id 
      AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_campaign_member_role(p_campaign_id UUID, p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM campaign_members 
  WHERE campaign_id = p_campaign_id 
    AND user_id = p_user_id;
  
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
