-- Migration: Allow users to view profiles of other campaign members
-- This fixes the issue where campaign members show as "Unknown user"
-- because the users table RLS was blocking the join

-- Add policy to allow viewing profiles of users in the same campaign
CREATE POLICY "Users can view profiles of campaign members"
ON public.users
FOR SELECT
USING (
  -- Allow viewing own profile
  auth.uid() = id
  OR
  -- Allow viewing profiles of users in campaigns you're a member of
  EXISTS (
    SELECT 1
    FROM public.campaign_members cm1
    JOIN public.campaign_members cm2 ON cm1.campaign_id = cm2.campaign_id
    WHERE cm1.user_id = auth.uid()
      AND cm2.user_id = users.id
  )
);

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
