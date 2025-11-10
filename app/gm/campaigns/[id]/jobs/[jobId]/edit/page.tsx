import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import JobForm from '@/components/gm/JobForm'
import type { Job, Organization, MissionType } from '@/types/database'

interface Props {
  params: Promise<{
    id: string
    jobId: string
  }>
}

export default async function EditJobPage({ params }: Props) {
  const { id: campaignId, jobId } = await params
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch the job
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('campaign_id', campaignId)
    .single()

  if (jobError || !job) {
    notFound()
  }

  // Check permissions: user must be creator, campaign owner, or co-GM
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('gm_id')
    .eq('id', campaignId)
    .single()

  const isCreator = job.created_by === user.id
  const isOwner = campaign?.gm_id === user.id

  // Check if user is a co-GM
  const { data: membership } = await supabase
    .from('campaign_members')
    .select('role')
    .eq('campaign_id', campaignId)
    .eq('user_id', user.id)
    .single()

  const isCoGM = membership?.role === 'co-gm'

  if (!isCreator && !isOwner && !isCoGM) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h1 className="text-xl font-semibold text-red-900 mb-2">Access Denied</h1>
            <p className="text-red-700">
              You don't have permission to edit this job. Only the job creator, campaign owner, or co-GMs can edit jobs.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Fetch organizations and mission types for the form
  const [orgsResult, typesResult] = await Promise.all([
    supabase
      .from('organizations')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('name'),
    supabase
      .from('mission_types')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('name'),
  ])

  const organizations = (orgsResult.data || []) as Organization[]
  const missionTypes = (typesResult.data || []) as MissionType[]

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <a
            href={`/gm/campaigns/${campaignId}/jobs/${jobId}`}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Back to Job
          </a>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-8">Edit Job</h1>

        <JobForm
          campaignId={campaignId}
          job={job as Job}
          organizations={organizations}
          missionTypes={missionTypes}
        />
      </div>
    </div>
  )
}
