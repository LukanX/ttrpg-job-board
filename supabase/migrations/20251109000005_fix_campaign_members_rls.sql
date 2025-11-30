-- Fix infinite recursion in RLS policies
-- The issue: campaigns checks campaign_members, campaign_members checks campaigns → infinite loop
-- Solution: Break the cycle by making policies check direct columns without mutual recursion

-- =====================================================
-- Step 1: Drop ALL existing policies on both tables
-- =====================================================

-- Drop campaign_members policies
DROP POLICY IF EXISTS "Users can view members of their campaigns" ON campaign_members;
DROP POLICY IF EXISTS "Campaign owners can manage members" ON campaign_members;
DROP POLICY IF EXISTS "Users can view members of campaigns they belong to" ON campaign_members;
DROP POLICY IF EXISTS "Campaign owners can insert members" ON campaign_members;
DROP POLICY IF EXISTS "Campaign owners can update members" ON campaign_members;
DROP POLICY IF EXISTS "Campaign owners can delete members" ON campaign_members;

-- Drop campaigns policies (including any we may have created in previous runs)
DROP POLICY IF EXISTS "Users can view their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can view campaigns they're members of" ON campaigns;
DROP POLICY IF EXISTS "Users can view campaigns they own or are members of" ON campaigns;
DROP POLICY IF EXISTS "Users can insert campaigns (auto-add as owner)" ON campaigns;
DROP POLICY IF EXISTS "Campaign owners and co-gms can update" ON campaigns;
DROP POLICY IF EXISTS "Campaign owners can delete" ON campaigns;

-- =====================================================
-- Step 2: Create helper function to avoid recursion
-- =====================================================

-- This function checks if a user can access a campaign WITHOUT using RLS
-- This breaks the recursion cycle
CREATE OR REPLACE FUNCTION user_can_access_campaign(campaign_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user is the owner OR is a member
  RETURN EXISTS (
    SELECT 1 FROM campaigns WHERE id = campaign_uuid AND gm_id = user_uuid
  ) OR EXISTS (
    SELECT 1 FROM campaign_members WHERE campaign_id = campaign_uuid AND user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Step 3: Create non-recursive policies using the function
-- =====================================================

-- CAMPAIGNS policies: Use helper function to avoid recursion
CREATE POLICY "Users can view campaigns they own or are members of"
ON campaigns FOR SELECT
USING (user_can_access_campaign(id, auth.uid()));

CREATE POLICY "Users can insert campaigns (auto-add as owner)"
ON campaigns FOR INSERT
WITH CHECK (gm_id = auth.uid());

CREATE POLICY "Campaign owners and co-gms can update"
ON campaigns FOR UPDATE
USING (
  gm_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM campaign_members cm 
    WHERE cm.campaign_id = id 
      AND cm.user_id = auth.uid() 
      AND cm.role IN ('owner', 'co-gm')
  )
);

CREATE POLICY "Campaign owners can delete"
ON campaigns FOR DELETE
USING (gm_id = auth.uid());

-- CAMPAIGN_MEMBERS policies: Simple, non-recursive checks
CREATE POLICY "Users can view members of campaigns they belong to"
ON campaign_members FOR SELECT
USING (
  user_id = auth.uid() -- Can see own membership
  OR
  EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_id AND c.gm_id = auth.uid()) -- Or is campaign owner
);

-- Only owners can insert/update/delete members
CREATE POLICY "Campaign owners can insert members"
ON campaign_members FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_id AND c.gm_id = auth.uid())
);

CREATE POLICY "Campaign owners can update members"
ON campaign_members FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_id AND c.gm_id = auth.uid())
);

CREATE POLICY "Campaign owners can delete members"
ON campaign_members FOR DELETE
USING (
  EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_id AND c.gm_id = auth.uid())
);
