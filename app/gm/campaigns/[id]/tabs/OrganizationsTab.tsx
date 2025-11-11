'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Organization } from '@/types/database'
import ConfirmModal from '@/components/ui/ConfirmModal'
import EditOrganizationModal from '@/components/gm/EditOrganizationModal'

interface Props {
  campaignId: string
  organizations: Organization[]
}

export default function OrganizationsTab({ campaignId, organizations }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [factionType, setFactionType] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [toDeleteId, setToDeleteId] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/organizations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: description || null, faction_type: factionType || null }),
      })

      let bodyResp: any = {}
      try { bodyResp = await res.json() } catch {}

      if (!res.ok) {
        throw new Error(bodyResp?.error || `Failed to create organization (status ${res.status})`)
      }

      setName('')
      setDescription('')
      setFactionType('')
      setShowForm(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Organizations & Factions</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : '+ Add Organization'}
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
                Organization Name *
              </label>
              <input
                type="text"
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                placeholder="e.g., Starfinder Society, Veskarium"
              />
            </div>

            <div>
              <label htmlFor="factionType" className="block text-sm font-medium text-gray-700">
                Faction Type
              </label>
              <input
                type="text"
                id="factionType"
                value={factionType}
                onChange={(e) => setFactionType(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                placeholder="e.g., Government, Corporation, Criminal Syndicate"
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
                placeholder="Brief description of the organization..."
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Adding...' : 'Add Organization'}
              </button>
            </div>
          </form>
        </div>
      )}

      {organizations.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {organizations.map((org) => (
            <div key={org.id} className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{org.name}</h3>
              {org.faction_type && (
                <p className="text-sm text-blue-600 font-medium mb-2">{org.faction_type}</p>
              )}
              {org.description && <p className="text-sm text-gray-600">{org.description}</p>}

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    setEditingOrg(org)
                    setEditModalOpen(true)
                  }}
                  className="px-3 py-1 border rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    setToDeleteId(org.id)
                    setConfirmOpen(true)
                  }}
                  className="px-3 py-1 bg-red-600 text-white rounded"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No organizations yet</h3>
          <p className="text-gray-600 mb-6">
            Add organizations and factions to use in job generation
          </p>
        </div>
      )}
      {/* Delete confirmation modal */}
      <ConfirmModal
        isOpen={confirmOpen}
        title="Delete organization"
        message="Are you sure you want to delete this organization? This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={() => {
          setConfirmOpen(false)
          setToDeleteId(null)
        }}
        onConfirm={async () => {
          if (!toDeleteId) return
          setLoading(true)
          setError(null)
          try {
            const res = await fetch(`/api/campaigns/${campaignId}/organizations?orgId=${toDeleteId}`, {
              method: 'DELETE',
            })

            let body: any = {}
            try { body = await res.json() } catch {}

            if (!res.ok) {
              throw new Error(body?.error || `Delete failed (status ${res.status})`)
            }

            setConfirmOpen(false)
            setToDeleteId(null)
            router.refresh()
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete organization')
          } finally {
            setLoading(false)
          }
        }}
      />
      <EditOrganizationModal
        isOpen={editModalOpen}
        organization={editingOrg}
        onClose={() => {
          setEditModalOpen(false)
          setEditingOrg(null)
        }}
        onSaved={() => router.refresh()}
      />
    </div>
  )
}
