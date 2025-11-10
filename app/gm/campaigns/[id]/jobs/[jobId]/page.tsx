import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Edit } from 'lucide-react'
import type { Job, Organization, MissionType, Encounter, NPC } from '@/types/database'

interface Props {
  params: Promise<{
    id: string
    jobId: string
  }>
}

export default async function JobDetailPage({ params }: Props) {
  const { id: campaignId, jobId } = await params
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch job with related data
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('campaign_id', campaignId)
    .single()

  if (jobError || !job) {
    notFound()
  }

  // Fetch campaign to verify ownership
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('gm_id')
    .eq('id', campaignId)
    .single()

  // Check permissions for edit button visibility
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
  const canEdit = isCreator || isOwner || isCoGM

  if (!campaign && !membership) {
    notFound()
  }

  // Fetch related data
  const [organizationResult, missionTypeResult, encountersResult, npcsResult] = await Promise.all([
    job.organization_id
      ? supabase.from('organizations').select('*').eq('id', job.organization_id).single()
      : Promise.resolve({ data: null }),
    job.mission_type_id
      ? supabase.from('mission_types').select('*').eq('id', job.mission_type_id).single()
      : Promise.resolve({ data: null }),
    supabase.from('encounters').select('*').eq('job_id', jobId).order('created_at'),
    supabase.from('npcs').select('*').eq('job_id', jobId).order('created_at'),
  ])

  const organization = organizationResult.data as Organization | null
  const missionType = missionTypeResult.data as MissionType | null
  const encounters = (encountersResult.data || []) as Encounter[]
  const npcs = (npcsResult.data || []) as NPC[]

  const getStatusBadge = (status: Job['status']) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      archived: 'bg-red-100 text-red-800',
    }
    return (
      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${colors[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const getDifficultyStars = (difficulty: number) => {
    return '★'.repeat(difficulty) + '☆'.repeat(10 - difficulty)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <a
            href={`/gm/campaigns/${campaignId}`}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Back to Campaign
          </a>
        </div>

        {/* Job Header */}
        <div className="bg-white shadow rounded-lg p-8 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{job.title}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                {organization && <span>📍 {organization.name}</span>}
                {missionType && <span>🎯 {missionType.name}</span>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge(job.status)}
              {canEdit && (
                <Link
                  href={`/gm/campaigns/${campaignId}/jobs/${jobId}/edit`}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md border border-blue-200"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Difficulty:</span>
              <span className="text-xl text-yellow-500">{getDifficultyStars(job.difficulty)}</span>
              <span className="text-sm text-gray-600">({job.difficulty}/10)</span>
            </div>
            {job.reward && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Reward:</span>
                <span className="text-sm text-gray-900">💰 {job.reward}</span>
              </div>
            )}
          </div>

          <div className="prose max-w-none">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Mission Briefing</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{job.description}</p>
          </div>
        </div>

        {/* Encounters */}
        {encounters.length > 0 && (
          <div className="bg-white shadow rounded-lg p-8 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">⚔️ Encounters</h2>
            <div className="space-y-6">
              {encounters.map((encounter, index) => (
                <div key={encounter.id} className="border-l-4 border-blue-500 pl-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Encounter {index + 1}: {encounter.encounter_type}
                    </h3>
                    {encounter.challenge_rating && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded">
                        {encounter.challenge_rating}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-700 mb-3">{encounter.description}</p>
                  {encounter.enemies && (
                    <div className="bg-gray-50 rounded p-3">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Enemies & Tactics:</h4>
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                        {JSON.stringify(encounter.enemies, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NPCs */}
        {npcs.length > 0 && (
          <div className="bg-white shadow rounded-lg p-8 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">👥 NPCs</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {npcs.map((npc) => (
                <div key={npc.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{npc.name}</h3>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                      {npc.role}
                    </span>
                  </div>
                  {npc.personality && (
                    <p className="text-sm text-gray-700 mb-3 italic">{npc.personality}</p>
                  )}
                  {npc.stats_block && (
                    <div className="bg-gray-50 rounded p-3">
                      <h4 className="text-xs font-semibold text-gray-900 mb-1">Stats:</h4>
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                        {JSON.stringify(npc.stats_block, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GM Notes */}
        {job.gm_notes && (
          <div className="bg-yellow-50 border-2 border-yellow-200 shadow rounded-lg p-8">
            <h2 className="text-2xl font-bold text-yellow-900 mb-4">🔒 GM Notes (Secret)</h2>
            <p className="text-yellow-900 whitespace-pre-wrap">{job.gm_notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
