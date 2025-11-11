'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Organization, MissionType } from '@/types/database'

export default function GenerateJobPage() {
  const router = useRouter()
  const params = useParams()
  const campaignId = params.id as string
  const supabase = createClient()

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [missionTypes, setMissionTypes] = useState<MissionType[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [organizationId, setOrganizationId] = useState('')
  const [missionTypeId, setMissionTypeId] = useState('')
  const [difficulty, setDifficulty] = useState(5)
  const [additionalContext, setAdditionalContext] = useState('')

  useEffect(() => {
    async function fetchData() {
      try {
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

        if (orgsResult.error) throw orgsResult.error
        if (typesResult.error) throw typesResult.error

        setOrganizations(orgsResult.data || [])
        setMissionTypes(typesResult.data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [campaignId, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setGenerating(true)

    try {
      const response = await fetch('/api/jobs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          organizationId: organizationId || null,
          missionTypeId: missionTypeId || null,
          difficulty,
          additionalContext: additionalContext || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate job')
      }

      const { jobId } = await response.json()
      router.push(`/gm/campaigns/${campaignId}/jobs/${jobId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate job')
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Back to Campaign
          </button>
        </div>

        <div className="bg-white shadow rounded-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            ✨ Generate Mission Job
          </h1>
          <p className="text-gray-600 mb-6">
            Use AI to generate a Starfinder 2E mission job with encounters and NPCs
          </p>

          {error && (
            <div className="rounded-md bg-red-50 p-4 mb-6">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          {organizations.length === 0 && (
            <div className="rounded-md bg-yellow-50 p-4 mb-6">
              <div className="text-sm text-yellow-800">
                <strong>Tip:</strong> Add organizations and mission types first for better job generation results.
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="organization" className="block text-sm font-medium text-gray-700">
                Organization (optional)
              </label>
              <select
                id="organization"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
              >
                <option value="">-- Select Organization --</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} {org.faction_type && `(${org.faction_type})`}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">
                Which organization is offering this job?
              </p>
            </div>

            <div>
              <label htmlFor="missionType" className="block text-sm font-medium text-gray-700">
                Mission Type (optional)
              </label>
              <select
                id="missionType"
                value={missionTypeId}
                onChange={(e) => setMissionTypeId(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
              >
                <option value="">-- Select Mission Type --</option>
                {missionTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">
                What kind of mission is this?
              </p>
            </div>

            <div>
              <label htmlFor="difficulty" className="block text-sm font-medium text-gray-700 mb-2">
                Difficulty: {difficulty}/10
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  id="difficulty"
                  min="1"
                  max="10"
                  value={difficulty}
                  onChange={(e) => setDifficulty(parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="text-2xl text-yellow-500">
                  {'★'.repeat(difficulty)}{'☆'.repeat(10 - difficulty)}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                How challenging should this mission be?
              </p>
            </div>

            <div>
              <label htmlFor="context" className="block text-sm font-medium text-gray-700">
                Additional Context (optional)
              </label>
              <textarea
                id="context"
                rows={4}
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                placeholder="Any specific details, themes, or requirements for this job? (e.g., &apos;Include a space station encounter&apos; or &apos;Make it stealth-focused&apos;)"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => router.back()}
                disabled={generating}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={generating}
                className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {generating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Generating...
                  </>
                ) : (
                  <>✨ Generate Job</>
                )}
              </button>
            </div>
          </form>

          {generating && (
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mt-0.5"></div>
                <div>
                  <h3 className="text-sm font-medium text-blue-900 mb-1">
                    AI is generating your mission...
                  </h3>
                  <p className="text-sm text-blue-700">
                    This may take 10-30 seconds. We&apos;re creating the job description, encounters, and NPCs for you.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
