import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role to run cleanup functions
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

/**
 * POST /api/admin/cleanup-invitations
 * Triggers cleanup of expired invitations
 * 
 * This can be called:
 * 1. Manually by an admin
 * 2. Via a cron job/scheduled task
 * 3. As part of regular maintenance
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Add authentication check for admin users
    // For now, we'll use a simple API key
    const authHeader = request.headers.get('authorization')
    const expectedKey = process.env.ADMIN_API_KEY
    
    if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Call the cleanup function
    const { data, error } = await supabaseAdmin.rpc('run_invitation_cleanup')

    if (error) {
      console.error('Cleanup error:', error)
      return NextResponse.json(
        { error: 'Failed to run cleanup', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Cleanup completed successfully',
    })
  } catch (err) {
    console.error('POST /api/admin/cleanup-invitations error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
