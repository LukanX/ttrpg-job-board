-- Add expires_at to campaign_invitations and index it
ALTER TABLE IF EXISTS campaign_invitations
ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '30 days');

-- Create an index to help queries that check for non-expired invites
CREATE INDEX IF NOT EXISTS idx_campaign_invitations_expires_at ON campaign_invitations (expires_at);

-- Optional: update existing rows without an expires_at to a 30-day window from creation
UPDATE campaign_invitations
SET expires_at = created_at + interval '30 days'
WHERE expires_at IS NULL AND created_at IS NOT NULL;
