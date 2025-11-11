'use client'

import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ui/ConfirmModal'

type InviteLink = {
  id: string
  campaign_id: string
  token: string
  created_by: string
  expires_at: string | null
  max_uses: number | null
  use_count: number
  require_approval: boolean
  is_active: boolean
  created_at: string
  revoked_at: string | null
}

interface Props {
  campaignId: string
  initialLinks?: InviteLink[]
}

export default function InviteLinksManager({ campaignId, initialLinks }: Props) {
  const router = useRouter()
  const [links, setLinks] = useState<InviteLink[]>(initialLinks ?? [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  // Form state
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [requireApproval, setRequireApproval] = useState(false)
  const [creating, setCreating] = useState(false)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalLinkId, setModalLinkId] = useState<string | null>(null)

  const fetchLinks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/invite-links`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to fetch invite links')
      }
      const json = await res.json()
      setLinks(json.inviteLinks || [])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err ?? 'Error')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError(null)

    try {
      const body: Record<string, unknown> = {
        requireApproval,
      }

      if (expiresAt) {
        body.expiresAt = new Date(expiresAt).toISOString()
      }

      if (maxUses) {
        const parsedMaxUses = parseInt(maxUses, 10)
        if (parsedMaxUses > 0) {
          body.maxUses = parsedMaxUses
        }
      }

      const res = await fetch(`/api/campaigns/${campaignId}/invite-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(json.error || 'Failed to create invite link')
      }

      // Reset form
      setExpiresAt('')
      setMaxUses('')
      setRequireApproval(false)
      setShowCreateForm(false)

      // Refresh list
      router.refresh()
      fetchLinks()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err ?? 'Create failed')
      setError(msg)
    } finally {
      setCreating(false)
    }
  }

  const copyToClipboard = (token: string) => {
    const baseUrl = window.location.origin
    const inviteUrl = `${baseUrl}/invite/campaign/${token}`
    
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopiedToken(token)
      setTimeout(() => setCopiedToken(null), 2000)
    })
  }

  const confirmRevoke = (linkId: string) => {
    setModalLinkId(linkId)
    setModalOpen(true)
  }

  const handleRevoke = async () => {
    if (!modalLinkId) return
    setModalOpen(false)
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/invite-links/${modalLinkId}`, {
        method: 'DELETE',
      })

      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(body.error || 'Failed to revoke invite link')
      }

      router.refresh()
      fetchLinks()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err ?? 'Revoke failed')
      setError(msg)
    } finally {
      setLoading(false)
      setModalLinkId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          {showCreateForm ? 'Cancel' : 'Create New Link'}
        </button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 px-3 py-2 rounded">
          {error}
        </div>
      )}

      {showCreateForm && (
        <form onSubmit={handleCreateLink} className="mb-6 p-4 bg-gray-50 rounded space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expires At (optional)
            </label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Uses (optional)
            </label>
            <input
              type="number"
              min="1"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="Unlimited"
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="requireApproval"
              checked={requireApproval}
              onChange={(e) => setRequireApproval(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="requireApproval" className="text-sm text-gray-700">
              Require approval before joining
            </label>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Invite Link'}
          </button>
        </form>
      )}

      {loading && !creating ? (
        <p className="text-sm text-gray-600">Loading invite links...</p>
      ) : (
        <div className="space-y-3">
          {links.length > 0 ? (
            links.map((link) => {
              const isExpired = link.expires_at ? new Date(link.expires_at) <= new Date() : false
              const maxUsesReached = link.max_uses !== null && link.use_count >= link.max_uses
              const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
              const inviteUrl = `${baseUrl}/invite/campaign/${link.token}`
              const isInactive = !link.is_active || isExpired || maxUsesReached

              return (
                <div
                  key={link.id}
                  className={`p-4 border rounded ${isInactive ? 'bg-gray-50 opacity-60' : 'bg-white'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          link.require_approval ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {link.require_approval ? 'Approval Required' : 'Open Invite'}
                        </span>
                        {!link.is_active && (
                          <span className="text-xs font-medium px-2 py-1 rounded bg-red-100 text-red-800">
                            Revoked
                          </span>
                        )}
                        {isExpired && (
                          <span className="text-xs font-medium px-2 py-1 rounded bg-gray-200 text-gray-700">
                            Expired
                          </span>
                        )}
                        {maxUsesReached && (
                          <span className="text-xs font-medium px-2 py-1 rounded bg-gray-200 text-gray-700">
                            Max Uses Reached
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          value={inviteUrl}
                          readOnly
                          className="flex-1 px-2 py-1 text-sm bg-gray-100 border rounded font-mono"
                        />
                        <button
                          onClick={() => copyToClipboard(link.token)}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          {copiedToken === link.token ? 'Copied!' : 'Copy'}
                        </button>
                      </div>

                      <div className="text-xs text-gray-600 space-y-1">
                        <p>
                          <strong>Uses:</strong> {link.use_count}
                          {link.max_uses ? ` / ${link.max_uses}` : ' (unlimited)'}
                        </p>
                        {link.expires_at && (
                          <p>
                            <strong>Expires:</strong> {new Date(link.expires_at).toLocaleString()}
                          </p>
                        )}
                        <p>
                          <strong>Created:</strong> {new Date(link.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {link.is_active && (
                      <button
                        onClick={() => confirmRevoke(link.id)}
                        disabled={loading}
                        className="ml-3 px-3 py-1 text-sm text-red-600 hover:text-red-800"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          ) : (
            <p className="text-sm text-gray-600">
              No invite links yet. Create one to share with potential members.
            </p>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={modalOpen}
        title="Revoke Invite Link"
        message="Are you sure you want to revoke this invite link? It will no longer be usable."
        onConfirm={handleRevoke}
        onCancel={() => {
          setModalOpen(false)
          setModalLinkId(null)
        }}
      />
    </div>
  )
}
