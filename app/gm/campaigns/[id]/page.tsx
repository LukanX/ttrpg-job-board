import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Edit } from 'lucide-react'
import type { Campaign, Organization, MissionType, Job } from '@/types/database'
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

        {/* Tabs */}
        <CampaignTabs
          campaignId={id}
          organizations={organizations || []}
          missionTypes={missionTypes || []}
          jobs={jobs || []}
        />
      </div>
    </div>
  )
}
