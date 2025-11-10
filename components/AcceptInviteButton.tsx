'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AcceptInviteButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleAccept = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error('Failed to accept invitation')
      setSuccess(true)
      // Refresh so any server components update
      try { router.refresh() } catch {}
    } catch (err: any) {
      setError(err?.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  if (success) return <div className="text-sm text-green-700">Invitation accepted — you're a member now.</div>

  return (
    <div>
      {error && <div className="text-sm text-red-700 mb-2">{error}</div>}
      <button
        onClick={handleAccept}
        disabled={loading}
        className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
      >
        {loading ? 'Accepting...' : 'Accept Invitation'}
      </button>
    </div>
  )
}
