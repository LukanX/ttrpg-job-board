'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface JoinCampaignButtonProps {
  token: string
}

export default function JoinCampaignButton({ token }: JoinCampaignButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [requiresApproval, setRequiresApproval] = useState(false)

  const handleJoin = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/invite-links/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        const errorMsg = body?.error || `Failed to join campaign (Status: ${res.status})`
        setError(errorMsg)
        return
      }

      if (body.requiresApproval) {
        setRequiresApproval(true)
        setSuccess(true)
      } else {
        setSuccess(true)
        // Redirect to campaign after successful join
        setTimeout(() => {
          if (body.member?.campaign_id) {
            router.push(`/gm/campaigns/${body.member.campaign_id}`)
          } else {
            router.push('/gm/dashboard')
          }
        }, 1500)
      }
    } catch (err) {
      console.error('Join campaign error:', err)
      setError(err instanceof Error ? err.message : 'Failed to join campaign')
    } finally {
      setLoading(false)
    }
  }

  if (success && requiresApproval) {
    return (
      <div className="rounded-md bg-blue-50 p-4">
        <p className="text-sm text-blue-800">
          ✓ Join request submitted! The campaign owner will review your request.
        </p>
      </div>
    )
  }

  if (success) {
    return (
      <div className="rounded-md bg-green-50 p-4">
        <p className="text-sm text-green-800">
          ✓ Successfully joined campaign! Redirecting...
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <button
        onClick={handleJoin}
        disabled={loading}
        className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Joining...' : 'Join Campaign'}
      </button>
    </div>
  )
}
