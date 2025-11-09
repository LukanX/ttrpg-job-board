-- Fix votes unique constraints to handle NULL values properly

-- Drop the existing unique constraints
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_job_id_user_id_key;
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_job_id_session_id_key;

-- Create partial unique indexes that handle NULL values correctly
-- For authenticated users (session_id will be NULL)
CREATE UNIQUE INDEX votes_job_user_unique 
  ON public.votes(job_id, user_id) 
  WHERE user_id IS NOT NULL;

-- For anonymous users (user_id will be NULL)
CREATE UNIQUE INDEX votes_job_session_unique 
  ON public.votes(job_id, session_id) 
  WHERE session_id IS NOT NULL;
