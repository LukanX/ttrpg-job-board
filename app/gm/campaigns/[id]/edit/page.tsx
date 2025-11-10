import React from 'react'
import CampaignForm from '@/components/gm/CampaignForm'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

interface Params {
  params: Promise<{ id: string }>
}

export default async function EditCampaignPage({ params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    // Not signed in -> redirect to login
    redirect('/login')
  }

  // Fetch campaign, restrict to current GM to satisfy RLS and ensure owner can edit
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('id, name, party_level, gm_id')
    .eq('id', id)
    .eq('gm_id', user.id)
    .single()

  if (error || !campaign) {
    // Render a friendly not-found view instead of redirecting silently
    return (
      <div className="max-w-2xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Campaign not found</h1>
          <p className="text-gray-600 mb-4">We couldn't find that campaign. It may have been deleted or the link is incorrect.</p>
          <a href="/gm/campaigns" className="text-blue-600 hover:text-blue-800">Back to campaigns</a>
        </div>
      </div>
    )
  }

  if (campaign.gm_id !== user.id) {
    // Render a forbidden view for clarity
    return (
      <div className="max-w-2xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access denied</h1>
          <p className="text-gray-600 mb-4">You don't have permission to edit this campaign.</p>
          <a href="/gm/campaigns" className="text-blue-600 hover:text-blue-800">Back to campaigns</a>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Edit Campaign</h1>
        <div className="bg-white shadow rounded-lg p-6">
          {/* @ts-ignore server -> client prop passing */}
          <CampaignForm campaign={{ id: campaign.id, name: campaign.name, party_level: campaign.party_level }} />
        </div>
      </div>
    </div>
  )
}
