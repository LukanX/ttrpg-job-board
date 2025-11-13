'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Organization, MissionType } from '@/types/database'

interface RegenerateJobModalProps {
  campaignId: string
  jobId: string
  currentDifficulty: number
  currentOrganizationId?: string | null
  currentMissionTypeId?: string | null
  organizations: Organization[]
  missionTypes: MissionType[]
  onClose: () => void
}

export default function RegenerateJobModal({
  campaignId,
  jobId,
  currentDifficulty,
  currentOrganizationId,
  currentMissionTypeId,
  organizations,
  missionTypes,
  onClose,
}: RegenerateJobModalProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    difficulty: currentDifficulty,
    organizationId: currentOrganizationId || '',
    missionTypeId: currentMissionTypeId || '',
    additionalContext: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/jobs/${jobId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          difficulty: formData.difficulty,
          organizationId: formData.organizationId || null,
          missionTypeId: formData.missionTypeId || null,
          additionalContext: formData.additionalContext || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to regenerate job')
      }

      // Success - refresh and close
      router.refresh()
      onClose()
    } catch (err) {
      console.error('Error regenerating job:', err)
      setError(err instanceof Error ? err.message : 'Failed to regenerate job')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">🔄 Regenerate Job with AI</h2>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Warning: This will replace all job content</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    Regenerating this job will:
                  </p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Replace the title and description</li>
                    <li>Delete and regenerate all encounters</li>
                    <li>Delete and regenerate all NPCs</li>
                    <li>Overwrite GM notes</li>
                  </ul>
                  <p className="mt-2 font-semibold">Any manual edits you made will be lost.</p>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Difficulty */}
            <div>
              <label htmlFor="difficulty" className="block text-sm font-medium text-gray-700 mb-2">
                Difficulty (1-10)
              </label>
              <input
                type="number"
                id="difficulty"
                min={1}
                max={10}
                required
                value={formData.difficulty}
                onChange={(e) => setFormData({ ...formData, difficulty: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Organization */}
            <div>
              <label htmlFor="organization" className="block text-sm font-medium text-gray-700 mb-2">
                Organization (optional)
              </label>
              <select
                id="organization"
                value={formData.organizationId}
                onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Mission Type */}
            <div>
              <label htmlFor="missionType" className="block text-sm font-medium text-gray-700 mb-2">
                Mission Type (optional)
              </label>
              <select
                id="missionType"
                value={formData.missionTypeId}
                onChange={(e) => setFormData({ ...formData, missionTypeId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None</option>
                {missionTypes.map((mt) => (
                  <option key={mt.id} value={mt.id}>
                    {mt.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Additional Context */}
            <div>
              <label htmlFor="context" className="block text-sm font-medium text-gray-700 mb-2">
                Additional Context (optional)
              </label>
              <textarea
                id="context"
                rows={3}
                value={formData.additionalContext}
                onChange={(e) => setFormData({ ...formData, additionalContext: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Any specific requirements for the regenerated job..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Regenerating...' : '🔄 Regenerate Job'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
