import JobForm from '@/components/gm/JobForm'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Organization, MissionType } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function NewJobPage({ params }: Props) {
  const { id: campaignId } = await params

  if (!campaignId) return notFound()

  const supabase = await createClient()

  const [{ data: orgs, error: orgError }, { data: types, error: typesError }] = await Promise.all([
    supabase.from('organizations').select('*').eq('campaign_id', campaignId).order('name'),
    supabase.from('mission_types').select('*').eq('campaign_id', campaignId).order('name'),
  ])

  if (orgError) throw orgError
  if (typesError) throw typesError

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <a href={`/gm/campaigns/${campaignId}`} className="text-blue-600 hover:text-blue-800 font-medium">← Back to Campaign</a>
        </div>

        <div className="bg-white shadow rounded-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Mission Job</h1>
          <p className="text-gray-600 mb-6">Create a mission job manually for your campaign.</p>

          <JobForm campaignId={campaignId} organizations={(orgs as Organization[]) || []} missionTypes={(types as MissionType[]) || []} />
        </div>
      </div>
    </div>
  )
}
