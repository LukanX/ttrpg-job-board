-- Migration: Create campaign_invitations table for pending invites

CREATE TABLE IF NOT EXISTS campaign_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('co-gm', 'viewer')),
  token TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES users(id),
  invited_user_id UUID REFERENCES users(id),
  accepted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_campaign_invitations_campaign ON campaign_invitations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_invitations_email ON campaign_invitations(email);
