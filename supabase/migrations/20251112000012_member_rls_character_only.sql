-- Migration: add RLS policy to allow members to update only their own character_name
-- and a trigger to prevent changing other sensitive columns.

-- Enable RLS (no-op if already enabled)
ALTER TABLE IF EXISTS public.campaign_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if present (use portable DROP IF EXISTS)
DROP POLICY IF EXISTS member_update_character_only ON public.campaign_members;

-- Policy: allow authenticated user to UPDATE only their own row
CREATE POLICY member_update_character_only
  ON public.campaign_members
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create or replace function to prevent changes to sensitive columns
CREATE OR REPLACE FUNCTION public.prevent_member_column_changes()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Prevent changing role, campaign_id, or user_id
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    RAISE EXCEPTION 'Not allowed to change role';
  END IF;
  IF OLD.campaign_id IS DISTINCT FROM NEW.campaign_id THEN
    RAISE EXCEPTION 'Not allowed to change campaign_id';
  END IF;
  IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Not allowed to change user_id';
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if present, then create it
DROP TRIGGER IF EXISTS trg_prevent_member_column_changes ON public.campaign_members;
CREATE TRIGGER trg_prevent_member_column_changes
BEFORE UPDATE ON public.campaign_members
FOR EACH ROW
EXECUTE FUNCTION public.prevent_member_column_changes();
