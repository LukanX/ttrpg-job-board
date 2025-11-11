import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    // After exchanging code for session, ensure user profile exists in public.users
    if (!error && data?.user) {
      const userId = data.user.id
      const userEmail = data.user.email
      
      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single()
      
      // Create profile if it doesn't exist
      if (!existingProfile && userEmail) {
        const displayName = data.user.user_metadata?.display_name || data.user.email?.split('@')[0] || 'User'
        const role = data.user.user_metadata?.role || 'player'
        
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: userId,
            email: userEmail,
            display_name: displayName,
            role: role,
          })
        
        if (insertError) {
          console.error('Failed to create user profile in auth callback:', insertError)
        }
      }
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(requestUrl.origin)
}
