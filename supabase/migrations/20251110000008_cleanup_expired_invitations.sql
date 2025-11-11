-- Function to clean up expired invitations
-- This removes invitations that have been expired for more than 30 days
-- to keep audit trail but avoid clutter

CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete invitations that:
  -- 1. Have an expiry date
  -- 2. Expired more than 30 days ago
  DELETE FROM campaign_invitations
  WHERE expires_at IS NOT NULL
    AND expires_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a table to log cleanup runs (optional but useful)
CREATE TABLE IF NOT EXISTS invitation_cleanup_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cleaned_count INTEGER NOT NULL,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Function to run cleanup and log results
CREATE OR REPLACE FUNCTION run_invitation_cleanup()
RETURNS void AS $$
DECLARE
  cleaned INTEGER;
BEGIN
  cleaned := cleanup_expired_invitations();
  
  -- Log the cleanup run
  INSERT INTO invitation_cleanup_log (cleaned_count)
  VALUES (cleaned);
  
  -- Optional: Log to server logs
  IF cleaned > 0 THEN
    RAISE NOTICE 'Cleaned up % expired invitations', cleaned;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Note: To schedule this to run automatically, you would use pg_cron or an external scheduler
-- Example with pg_cron (if enabled):
-- SELECT cron.schedule('cleanup-expired-invitations', '0 2 * * *', 'SELECT run_invitation_cleanup();');
-- This would run daily at 2 AM

-- For now, GMs can manually trigger cleanup via a future admin API endpoint,
-- or you can run it as a scheduled job in your deployment environment
