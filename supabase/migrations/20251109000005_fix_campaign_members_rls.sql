-- Fix infinite recursion in campaign_members RLS policies
-- The issue: policies were checking campaign_members to grant access to campaign_members

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view members of their campaigns" ON campaign_members;
DROP POLICY IF EXISTS "Campaign owners can manage members" ON campaign_members;

-- New approach: simpler, non-recursive policies

-- Users can view campaign_members records where they are a member
-- This uses a direct user_id check, not a subquery to campaign_members
CREATE POLICY "Users can view members of campaigns they belong to"
ON campaign_members FOR SELECT
USING (
  campaign_id IN (
    SELECT cm.campaign_id 
    FROM campaign_members cm 
    WHERE cm.user_id = auth.uid()
  )
);

-- Only owners can insert/update/delete members
-- We check the campaigns table directly to see if user is the owner
CREATE POLICY "Campaign owners can insert members"
ON campaign_members FOR INSERT
WITH CHECK (
  campaign_id IN (
    SELECT c.id 
    FROM campaigns c 
    WHERE c.gm_id = auth.uid()
  )
);

CREATE POLICY "Campaign owners can update members"
ON campaign_members FOR UPDATE
USING (
  campaign_id IN (
    SELECT c.id 
    FROM campaigns c 
    WHERE c.gm_id = auth.uid()
  )
);

CREATE POLICY "Campaign owners can delete members"
ON campaign_members FOR DELETE
USING (
  campaign_id IN (
    SELECT c.id 
    FROM campaigns c 
    WHERE c.gm_id = auth.uid()
  )
);
