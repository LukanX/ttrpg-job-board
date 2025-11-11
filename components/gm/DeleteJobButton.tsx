"use client"

"use client"

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import { Trash } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'

interface Props {
  campaignId: string
  jobId: string
}

export default function DeleteJobButton({ campaignId, jobId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  async function doDelete() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'DELETE',
      })

      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(body?.error || 'Failed to delete job')
        setLoading(false)
        return
      }

      // Close modal and redirect back to campaign page
      setIsOpen(false)
      router.push(`/gm/campaigns/${campaignId}`)
    } catch (err) {
      console.error(err)
      setError('Failed to delete job')
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center">
      {/* Icon-only red trash button */}
      <button
        onClick={() => setIsOpen(true)}
        disabled={loading}
        aria-label="Delete job"
        title="Delete job"
        className="inline-flex items-center justify-center p-2 rounded-md text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100"
      >
        <Trash className="h-4 w-4" />
      </button>

      {error && <p className="text-sm text-red-600 ml-3">{error}</p>}

      <ConfirmModal
        isOpen={isOpen}
        title="Delete job"
        message="Delete this job? This action cannot be undone."
        confirmLabel={loading ? 'Deleting…' : 'Delete'}
        onConfirm={doDelete}
        onCancel={() => setIsOpen(false)}
        confirmTestId="delete-job-confirm"
        cancelTestId="delete-job-cancel"
      />
    </div>
  )
}
