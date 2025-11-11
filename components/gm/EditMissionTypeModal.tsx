"use client"

import React, { useState, useEffect, useRef } from 'react'

interface Props {
  isOpen: boolean
  onClose: () => void
  campaignId: string
  missionType: {
    id: string
    name: string
    description?: string | null
    tags?: string[] | null
  }
}

export default function EditMissionTypeModal({ isOpen, onClose, campaignId, missionType }: Props) {
  const [name, setName] = useState(missionType.name)
  const [description, setDescription] = useState<string>(missionType.description || '')
  const [tags, setTags] = useState<string>((missionType.tags || []).join(', '))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      setName(missionType.name)
      setDescription(missionType.description || '')
      setTags((missionType.tags || []).join(', '))
      setError(null)
    }
  }, [isOpen, missionType])

  useEffect(() => {
    if (!isOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen, onClose])

  async function handleSave() {
    setLoading(true)
    setError(null)

    try {
      const tagsArray = tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)

      const res = await fetch(`/api/campaigns/${campaignId}/mission-types`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: missionType.id, name, description: description || null, tags: tagsArray.length ? tagsArray : null }),
      })

      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body?.error || 'Failed to save')
        setLoading(false)
        return
      }

      onClose()
      try {
        // Refresh the page to update server components
        location.reload()
      } catch {}
    } catch (err) {
      console.error(err)
      setError('Failed to save')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-40" onClick={onClose} />

      <div ref={modalRef} className="bg-white rounded-lg shadow-lg z-10 max-w-lg w-full p-6">
        <h3 className="text-lg font-semibold mb-2">Edit mission type</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Tags (comma-separated)</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" className="px-3 py-1 border rounded" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              type="button"
              className="px-3 py-1 bg-blue-600 text-white rounded"
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
