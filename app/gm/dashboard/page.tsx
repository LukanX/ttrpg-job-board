import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Edit } from 'lucide-react'
import type { Campaign } from '@/types/database'

export default async function GMDashboard() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user's campaigns (try campaign_members first, fallback to gm_id for migration compatibility)
  const { data: campaignMembers, error: membersError } = await supabase
    .from('campaign_members')
    .select('campaign_id, role')
    .eq('user_id', user.id)

  let campaigns = null

  // If campaign_members table exists and has data, use it
  if (!membersError && campaignMembers && campaignMembers.length > 0) {
    const campaignIds = campaignMembers.map(m => m.campaign_id)
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .in('id', campaignIds)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching campaigns:', error)
    } else {
      campaigns = data
    }
  } else {
    // Fallback: fetch campaigns by gm_id (for pre-migration compatibility)
    console.log('Using fallback gm_id query (campaign_members table may not exist yet)')
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('gm_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching campaigns:', error)
    } else {
      campaigns = data
    }
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            My Campaigns
          </h1>
          <Link
            href="/gm/campaigns/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            + New Campaign
          </Link>
        </div>

        {campaigns && campaigns.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign: Campaign) => (
              <div
                key={campaign.id}
                className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start">
                    <Link href={`/gm/campaigns/${campaign.id}`} className="inline-block">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {campaign.name}
                      </h3>
                    </Link>
                    <Link
                      href={`/gm/campaigns/${campaign.id}/edit`}
                      aria-label={`Edit ${campaign.name}`}
                      className="ml-4 inline-flex items-center justify-center rounded-md p-2 text-blue-600 hover:bg-gray-100"
                    >
                      <Edit className="h-4 w-4" />
                      <span className="sr-only">Edit {campaign.name}</span>
                    </Link>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600">
                    <p>Party Level: {campaign.party_level}</p>
                    <p className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                      Share: {campaign.share_code}
                    </p>
                    <p className="text-xs text-gray-500">
                      Created {new Date(campaign.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No campaigns yet
            </h3>
            <p className="text-gray-600 mb-6">
              Get started by creating your first campaign
            </p>
            <Link
              href="/gm/campaigns/new"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Create Campaign
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
