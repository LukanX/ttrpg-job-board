import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Edit } from 'lucide-react'
import type { CampaignMemberRole } from '@/types/database'
import CampaignTabs from './CampaignTabs'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CampaignPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check campaign membership (with fallback for pre-migration compatibility)
  const { data: membership, error: memberError } = await supabase
    .from('campaign_members')
    .select('role')
    .eq('campaign_id', id)
    .eq('user_id', user.id)
    .single()

  // Fetch campaign
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single()

  if (campaignError || !campaign) {
    notFound()
  }

  // If campaign_members table doesn't exist yet (pre-migration), check gm_id instead
  if (memberError && !membership) {
    // Fallback to gm_id check
    if (campaign.gm_id !== user.id) {
      notFound()
    }
  } else if (!membership) {
    // campaign_members exists but user is not a member
    notFound()
  }

  // Determine user role: membership preferred, fallback to gm_id owner
  const userRole = membership?.role ?? (campaign.gm_id === user.id ? 'owner' : null)
  const canManageMembers = userRole === 'owner'

  // Fetch related data
  const { data: organizations } = await supabase
    .from('organizations')
    .select('*')
    .eq('campaign_id', id)
    .order('name')

  const { data: missionTypes } = await supabase
    .from('mission_types')
    .select('*')
    .eq('campaign_id', id)
    .order('name')

  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('campaign_id', id)
    .order('created_at', { ascending: false })

  // Fetch member count for the Members tab (server-side) so the tab shows an immediate count
  // Also fetch the full members list server-side so we can pass initial data to the client
  const { data: members } = await supabase
    .from('campaign_members')
    .select(
      `
      id,
      campaign_id,
      user_id,
      role,
      created_at,
      updated_at,
      character_name,
      users:user_id (
        id,
        email,
        display_name
      )
    `
    )
    .eq('campaign_id', id)
    .order('created_at', { ascending: true })

  const membersList = members || []
  const membersCount = membersList.length

  // Fetch pending invitations for display in Members tab
  const { data: invitations } = await supabase
    .from('campaign_invitations')
    .select('id, email, role, token, accepted, created_at, expires_at')
    .eq('campaign_id', id)
    .eq('accepted', false) // Only show pending invitations
    .order('created_at', { ascending: true })

  const invitationsList = invitations || []

  // Fetch invite links for display in Members tab (owners only)
  let inviteLinksList: Array<{
    id: string
    campaign_id: string
    token: string
    created_by: string
    expires_at: string | null
    max_uses: number | null
    use_count: number
    require_approval: boolean
    is_active: boolean
    created_at: string
    revoked_at: string | null
  }> = []
  
  let joinRequestsList: Array<{
    id: string
    campaign_id: string
    user_id: string
    invite_link_id: string | null
    status: 'pending' | 'approved' | 'rejected'
    requested_at: string
    reviewed_at: string | null
    reviewed_by: string | null
    users?: {
      id: string
      email: string
      display_name?: string | null
    } | null
  }> = []

  if (canManageMembers) {
    const { data: inviteLinks } = await supabase
      .from('campaign_invite_links')
      .select('id, campaign_id, token, created_by, expires_at, max_uses, use_count, require_approval, is_active, created_at, revoked_at')
      .eq('campaign_id', id)
      .order('created_at', { ascending: false })

    inviteLinksList = inviteLinks || []

    // Fetch join requests with user details
    const { data: joinRequests } = await supabase
      .from('campaign_join_requests')
      .select(`
        id,
        campaign_id,
        user_id,
        invite_link_id,
        status,
        requested_at,
        reviewed_at,
        reviewed_by,
        users!campaign_join_requests_user_id_fkey (
          id,
          email,
          display_name
        )
      `)
      .eq('campaign_id', id)
      .order('requested_at', { ascending: false })

    joinRequestsList = (joinRequests || []).map((req: any) => ({
      ...req,
      users: Array.isArray(req.users) ? req.users[0] : req.users
    }))
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/gm/dashboard"
            className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block"
          >
            ← Back to Campaigns
          </Link>
          <div className="flex justify-between items-start">
              <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {campaign.name}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Party Level: {campaign.party_level}
              </p>
              <div className="mt-3">
                <Link
                  href={`/gm/campaigns/${id}/edit`}
                  aria-label={`Edit ${campaign.name}`}
                  className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-blue-600 hover:bg-gray-100"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  <span>Edit Campaign</span>
                </Link>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Share Code</p>
              <p className="font-mono text-lg font-semibold text-blue-600">
                {campaign.share_code}
              </p>
              <a
                href={`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/share/${campaign.share_code}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                View player page →
              </a>
            </div>
          </div>
        </div>

        {/* Tabs (Members tab now included) */}
      <CampaignTabs
          campaignId={id}
          organizations={organizations || []}
          missionTypes={missionTypes || []}
          jobs={jobs || []}
        userRole={userRole as CampaignMemberRole | null}
          canManage={canManageMembers}
          membersCount={membersCount}
          initialMembers={membersList}
          initialInvitations={invitationsList}
          initialInviteLinks={inviteLinksList}
          initialJoinRequests={joinRequestsList}
          currentUserId={user.id}
        />
      </div>
    </div>
  )
}
