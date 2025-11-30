-- Migration: Create shareable campaign invite links system
-- This is different from email-based invitations - these are Discord-style shareable links

-- Table for shareable invite links
CREATE TABLE IF NOT EXISTS campaign_invite_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ,
  max_uses INTEGER, -- NULL means unlimited
  use_count INTEGER NOT NULL DEFAULT 0,
  require_approval BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_invite_links_campaign ON campaign_invite_links(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_invite_links_token ON campaign_invite_links(token);
CREATE INDEX IF NOT EXISTS idx_campaign_invite_links_active ON campaign_invite_links(is_active);

-- Table for join requests (when approval is required)
CREATE TABLE IF NOT EXISTS campaign_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invite_link_id UUID REFERENCES campaign_invite_links(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id),
  UNIQUE(campaign_id, user_id) -- Prevent duplicate requests for same campaign
);

CREATE INDEX IF NOT EXISTS idx_campaign_join_requests_campaign ON campaign_join_requests(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_join_requests_user ON campaign_join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_join_requests_status ON campaign_join_requests(status);

-- RLS Policies for campaign_invite_links
ALTER TABLE campaign_invite_links ENABLE ROW LEVEL SECURITY;

-- Campaign members can view invite links
CREATE POLICY "Campaign members can view invite links"
  ON campaign_invite_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_members.campaign_id = campaign_invite_links.campaign_id
      AND campaign_members.user_id = auth.uid()
    )
  );

-- Only campaign owners can create invite links
CREATE POLICY "Campaign owners can create invite links"
  ON campaign_invite_links
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_members.campaign_id = campaign_invite_links.campaign_id
      AND campaign_members.user_id = auth.uid()
      AND campaign_members.role = 'owner'
    )
  );

-- Only campaign owners can update/delete invite links
CREATE POLICY "Campaign owners can update invite links"
  ON campaign_invite_links
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_members.campaign_id = campaign_invite_links.campaign_id
      AND campaign_members.user_id = auth.uid()
      AND campaign_members.role = 'owner'
    )
  );

-- RLS Policies for campaign_join_requests
ALTER TABLE campaign_join_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own join requests
CREATE POLICY "Users can view own join requests"
  ON campaign_join_requests
  FOR SELECT
  USING (user_id = auth.uid());

-- Campaign owners can view all join requests for their campaigns
CREATE POLICY "Campaign owners can view join requests"
  ON campaign_join_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_members.campaign_id = campaign_join_requests.campaign_id
      AND campaign_members.user_id = auth.uid()
      AND campaign_members.role = 'owner'
    )
  );

-- Authenticated users can create join requests (checked in application logic)
CREATE POLICY "Authenticated users can create join requests"
  ON campaign_join_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only campaign owners can update join requests (approve/reject)
CREATE POLICY "Campaign owners can update join requests"
  ON campaign_join_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_members.campaign_id = campaign_join_requests.campaign_id
      AND campaign_members.user_id = auth.uid()
      AND campaign_members.role = 'owner'
    )
  );
