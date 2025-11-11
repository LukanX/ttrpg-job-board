"use client"

import React, { useState } from 'react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { Trash } from 'lucide-react'

interface Props {
  campaignId: string
  missionTypeId: string
}

export default function DeleteMissionTypeButton({ campaignId, missionTypeId }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function doDelete() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/mission-types`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: missionTypeId }),
      })

      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body?.error || 'Failed to delete')
        setLoading(false)
        return
      }

      setIsOpen(false)
      try {
        location.reload()
      } catch {}
    } catch (err) {
      console.error(err)
      setError('Failed to delete')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Delete mission type"
        title="Delete mission type"
        className="inline-flex items-center justify-center p-1 rounded-md text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100"
      >
        <Trash className="h-4 w-4" />
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <ConfirmModal
        isOpen={isOpen}
        title="Delete mission type"
        message="Delete this mission type? This cannot be undone."
        onConfirm={doDelete}
        onCancel={() => setIsOpen(false)}
        confirmLabel={loading ? 'Deleting…' : 'Delete'}
        confirmTestId="delete-mt-confirm"
        cancelTestId="delete-mt-cancel"
      />
    </div>
  )
}
