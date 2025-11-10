'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Job, Organization, MissionType } from '@/types/database'

interface JobFormProps {
  campaignId: string
  job?: Job // Optional: if provided, we're editing
  organizations: Organization[]
  missionTypes: MissionType[]
}

export default function JobForm({ campaignId, job, organizations, missionTypes }: JobFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    title: job?.title || '',
    description: job?.description || '',
    difficulty: job?.difficulty || 5,
    reward: job?.reward || '',
    status: job?.status || 'active' as Job['status'],
    gm_notes: job?.gm_notes || '',
    organization_id: job?.organization_id || '',
    mission_type_id: job?.mission_type_id || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      if (job) {
        // Update existing job
        const response = await fetch(`/api/jobs/${job.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formData.title,
            description: formData.description,
            difficulty: formData.difficulty,
            reward: formData.reward || null,
            status: formData.status,
            gm_notes: formData.gm_notes || null,
            organization_id: formData.organization_id || null,
            mission_type_id: formData.mission_type_id || null,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to update job')
        }

        // Navigate back to job detail page
        router.push(`/gm/campaigns/${campaignId}/jobs/${job.id}`)
        router.refresh()
      } else {
        // Create new job (not implemented yet - would be manual creation)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          throw new Error('Not authenticated')
        }

        const { data, error: insertError } = await supabase
          .from('jobs')
          .insert({
            campaign_id: campaignId,
            title: formData.title,
            description: formData.description,
            difficulty: formData.difficulty,
            reward: formData.reward || null,
            status: formData.status,
            gm_notes: formData.gm_notes || null,
            organization_id: formData.organization_id || null,
            mission_type_id: formData.mission_type_id || null,
            created_by: user.id,
          })
          .select()
          .single()

        if (insertError) throw insertError

        // Navigate to the new job's detail page
        router.push(`/gm/campaigns/${campaignId}/jobs/${data.id}`)
        router.refresh()
      }
    } catch (err) {
      console.error('Error saving job:', err)
      setError(err instanceof Error ? err.message : 'Failed to save job')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white shadow rounded-lg p-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
          Job Title *
        </label>
        <input
          type="text"
          id="title"
          required
          maxLength={200}
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., Rescue Mission on Absalom Station"
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
          Description *
        </label>
        <textarea
          id="description"
          required
          rows={6}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Describe the mission briefing..."
        />
      </div>

      {/* Organization and Mission Type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="organization" className="block text-sm font-medium text-gray-700 mb-2">
            Organization
          </label>
          <select
            id="organization"
            value={formData.organization_id}
            onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}
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

        <div>
          <label htmlFor="missionType" className="block text-sm font-medium text-gray-700 mb-2">
            Mission Type
          </label>
          <select
            id="missionType"
            value={formData.mission_type_id}
            onChange={(e) => setFormData({ ...formData, mission_type_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">None</option>
            {missionTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Difficulty and Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="difficulty" className="block text-sm font-medium text-gray-700 mb-2">
            Difficulty (1-10) *
          </label>
          <input
            type="number"
            id="difficulty"
            required
            min={1}
            max={10}
            value={formData.difficulty}
            onChange={(e) => setFormData({ ...formData, difficulty: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-sm text-gray-500">
            {'★'.repeat(formData.difficulty)}{'☆'.repeat(10 - formData.difficulty)}
          </p>
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
            Status *
          </label>
          <select
            id="status"
            required
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as Job['status'] })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Reward */}
      <div>
        <label htmlFor="reward" className="block text-sm font-medium text-gray-700 mb-2">
          Reward
        </label>
        <input
          type="text"
          id="reward"
          maxLength={500}
          value={formData.reward}
          onChange={(e) => setFormData({ ...formData, reward: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., 5,000 credits + faction reputation"
        />
      </div>

      {/* GM Notes */}
      <div>
        <label htmlFor="gm_notes" className="block text-sm font-medium text-gray-700 mb-2">
          GM Notes (Secret)
        </label>
        <textarea
          id="gm_notes"
          rows={4}
          value={formData.gm_notes}
          onChange={(e) => setFormData({ ...formData, gm_notes: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-yellow-50"
          placeholder="Private notes for the GM (not visible to players)"
        />
      </div>

      {/* Buttons */}
      <div className="flex items-center justify-end gap-4 pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : job ? 'Update Job' : 'Create Job'}
        </button>
      </div>
    </form>
  )
}
