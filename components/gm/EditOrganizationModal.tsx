"use client"

import React, { useEffect, useState } from 'react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import type { Organization } from '@/types/database'

type Props = {
  isOpen: boolean
  organization: Organization | null
  onClose: () => void
  onSaved: () => void
}

export default function EditOrganizationModal({ isOpen, organization, onClose, onSaved }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [factionType, setFactionType] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // use server API instead of client supabase for updates

  useEffect(() => {
    if (!organization) return
    setName(organization.name)
    setDescription(organization.description || '')
    setFactionType(organization.faction_type || '')
    setError(null)
  }, [organization])

  if (!isOpen || !organization) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-40" onClick={onClose} />

      <div className="bg-white rounded-lg shadow-lg z-10 max-w-2xl w-full p-6">
        <h3 className="text-lg font-semibold mb-2">Edit Organization</h3>

        {error && <div className="rounded-md bg-red-50 p-3 mb-4 text-sm text-red-800">{error}</div>}

        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setLoading(true)
            setError(null)
            try {
              const res = await fetch(`/api/campaigns/${organization.campaign_id}/organizations`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orgId: organization.id, name, description: description || null, faction_type: factionType || null }),
              })

              let body: any = {}
              try { body = await res.json() } catch {}

              if (!res.ok) {
                throw new Error(body?.error || `Update failed (status ${res.status})`)
              }

              onSaved()
              onClose()
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to update organization')
            } finally {
              setLoading(false)
            }
          }}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm px-3 py-2 border"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Faction Type</label>
              <input
                value={factionType}
                onChange={(e) => setFactionType(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm px-3 py-2 border"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm px-3 py-2 border"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button type="button" className="px-3 py-2 border rounded" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded" disabled={loading}>
                {loading ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
