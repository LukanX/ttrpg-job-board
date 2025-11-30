import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Edit, User, Shield } from 'lucide-react'
import type { Campaign, CampaignMemberRole } from '@/types/database'

export default async function Dashboard() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user's campaigns with role
  const { data: members, error: membersError } = await supabase
    .from('campaign_members')
    .select('role, campaign:campaigns(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (membersError) {
    console.error('Error fetching campaigns:', membersError)
  }

  const campaigns = members?.map(m => {
    const campaign = Array.isArray(m.campaign) ? m.campaign[0] : m.campaign
    return {
      ...(campaign as Campaign),
      userRole: m.role as CampaignMemberRole
    }
  }).filter(c => c.id) || []

  const gmCampaigns = campaigns.filter(c => c.userRole === 'owner' || c.userRole === 'co-gm')
  const playerCampaigns = campaigns.filter(c => c.userRole === 'viewer')

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Dashboard
          </h1>
          <Link
            href="/campaigns/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            + New Campaign
          </Link>
        </div>

        {gmCampaigns.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Campaigns I Run
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {gmCampaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start">
                      <Link href={`/campaigns/${campaign.id}`} className="inline-block">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {campaign.name}
                        </h3>
                      </Link>
                      <Link
                        href={`/campaigns/${campaign.id}/edit`}
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
                        Created: {new Date(campaign.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {playerCampaigns.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <User className="w-5 h-5 mr-2" />
              Campaigns I Play In
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {playerCampaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start">
                      <Link href={`/campaigns/${campaign.id}`} className="inline-block">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {campaign.name}
                        </h3>
                      </Link>
                    </div>

                    <div className="space-y-2 text-sm text-gray-600">
                      <p>Party Level: {campaign.party_level}</p>
                      <p className="text-xs text-gray-500">
                        Joined: {new Date(campaign.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {campaigns.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">You haven't joined or created any campaigns yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
