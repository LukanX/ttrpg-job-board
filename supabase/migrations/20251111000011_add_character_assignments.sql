-- Migration: Add character assignment to campaign members
-- Allows members to assign themselves to a character they're playing

ALTER TABLE campaign_members
ADD COLUMN IF NOT EXISTS character_name TEXT;

-- Add index for character lookups
CREATE INDEX IF NOT EXISTS idx_campaign_members_character ON campaign_members(character_name) WHERE character_name IS NOT NULL;

-- Note: RLS policies already exist for campaign_members, no changes needed
-- Members can already update their own records through existing policies
