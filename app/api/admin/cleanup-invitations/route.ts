import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

  // Create service role client (bypasses RLS for cleanup)
  let supabaseAdmin
  try {
    supabaseAdmin = createAdminClient()
  } catch (err) {
    console.error('Failed to create Supabase service client:', err)
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  // Call the cleanup function
  const { error } = await supabaseAdmin.rpc('run_invitation_cleanup')

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
