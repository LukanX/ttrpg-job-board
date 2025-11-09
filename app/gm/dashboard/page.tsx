import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Campaign } from '@/types/database'

export default async function GMDashboard() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user's campaigns
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('gm_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching campaigns:', error)
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
              <Link
                key={campaign.id}
                href={`/gm/campaigns/${campaign.id}`}
                className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {campaign.name}
                  </h3>
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
              </Link>
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
