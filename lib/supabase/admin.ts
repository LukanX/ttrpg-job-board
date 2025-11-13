import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client with service role privileges (bypasses RLS).
 * Use ONLY for server-side admin operations.
 * 
 * In Docker environments, uses SUPABASE_URL_INTERNAL to connect via host.docker.internal
 * Otherwise falls back to NEXT_PUBLIC_SUPABASE_URL
 */
export function createAdminClient() {
  // Use internal URL for Docker, fallback to public URL
  const url = process.env.SUPABASE_URL_INTERNAL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('Missing SUPABASE_URL_INTERNAL or NEXT_PUBLIC_SUPABASE_URL')
  }

  if (!key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}
