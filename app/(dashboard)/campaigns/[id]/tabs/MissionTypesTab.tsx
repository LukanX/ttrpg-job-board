"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { MissionType } from '@/types/database'
import EditMissionTypeModal from '@/components/gm/EditMissionTypeModal'
import DeleteMissionTypeButton from '@/components/gm/DeleteMissionTypeButton'
import { Edit } from 'lucide-react'

interface Props {
  campaignId: string
  missionTypes: MissionType[]
}

export default function MissionTypesTab({ campaignId, missionTypes }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<null | MissionType>(null)
  const router = useRouter()
  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const tagsArray = tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)

      const res = await fetch(`/api/campaigns/${campaignId}/mission-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: description || null, tags: tagsArray.length > 0 ? tagsArray : null }),
      })

      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Failed to create mission type')

      setName('')
      setDescription('')
      setTags('')
      setShowForm(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create mission type')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Mission Types</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : '+ Add Mission Type'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-800">{error}</div>
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Mission Type Name *
              </label>
              <input
                type="text"
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                placeholder="e.g., Exploration, Combat, Investigation"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                placeholder="Brief description of this mission type..."
              />
            </div>

            <div>
              <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                placeholder="e.g., combat, stealth, social, space"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Adding...' : 'Add Mission Type'}
              </button>
            </div>
          </form>
        </div>
      )}

      {missionTypes.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {missionTypes.map((missionType) => (
            <div key={missionType.id} className="bg-white shadow rounded-lg p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{missionType.name}</h3>
                  {missionType.description && (
                    <p className="text-sm text-gray-600 mb-3">{missionType.description}</p>
                  )}
                  {missionType.tags && missionType.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {missionType.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-start gap-2">
                  <button
                    onClick={() => setEditing(missionType)}
                    title="Edit mission type"
                    aria-label="Edit mission type"
                    className="inline-flex items-center justify-center p-1 rounded-md text-gray-600 hover:bg-gray-50 border border-transparent hover:border-gray-100"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <DeleteMissionTypeButton campaignId={campaignId} missionTypeId={missionType.id} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No mission types yet</h3>
          <p className="text-gray-600 mb-6">
            Add mission types to categorize and guide job generation
          </p>
        </div>
      )}

      {editing && (
        <EditMissionTypeModal
          isOpen={Boolean(editing)}
          onClose={() => setEditing(null)}
          campaignId={campaignId}
          missionType={editing}
        />
      )}
    </div>
  )
}
