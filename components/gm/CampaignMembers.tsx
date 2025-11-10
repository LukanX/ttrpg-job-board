'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Member = {
  id: string
  campaign_id: string
  user_id: string
  role: 'owner' | 'co-gm' | 'viewer'
  created_at: string
  users: { id: string; email: string; display_name?: string | null }
}

interface Props {
  campaignId: string
  userRole?: 'owner' | 'co-gm' | 'viewer' | null
  canManage?: boolean
  initialMembers?: Member[]
}

export default function CampaignMembers({ campaignId, userRole, canManage, initialMembers }: Props) {
  const router = useRouter()
  const [members, setMembers] = useState<Member[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Invite form
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'co-gm' | 'viewer'>('co-gm')
  const [submitting, setSubmitting] = useState(false)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/members`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to fetch members')
      }
      const json = await res.json()
      setMembers(json.members || [])
    } catch (err: any) {
      setError(err?.message || 'Error')
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => {
    // If server provided initial members, use them to avoid an extra client fetch
    if (initialMembers && initialMembers.length > 0) {
      setMembers(initialMembers)
      setLoading(false)
      return
    }

    fetchMembers()
  }, [fetchMembers])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: inviteRole }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to invite')
      // success - clear and ask the page to refresh server data
      setEmail('')
      setInviteRole('co-gm')
      // refresh the server component so it can provide canonical members
      try {
        router.refresh()
      } catch {}
    } catch (err: any) {
      setError(err?.message || 'Invite failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleChangeRole = async (memberId: string, role: 'co-gm' | 'viewer') => {
    if (!confirm('Change member role?')) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, role }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to update role')
      try {
        router.refresh()
      } catch {}
    } catch (err: any) {
      setError(err?.message || 'Role update failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async (memberId: string) => {
    if (!confirm('Remove this member from the campaign?')) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/members?memberId=${memberId}`, {
        method: 'DELETE',
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to remove member')
      try {
        router.refresh()
      } catch {}
    } catch (err: any) {
      setError(err?.message || 'Remove failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white shadow rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Campaign Members</h2>
        <p className="text-sm text-gray-600">Role: {userRole ?? '—'}</p>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 px-3 py-2 rounded">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-600">Loading members…</p>
      ) : (
        <div className="space-y-3 mb-4">
          {members && members.length > 0 ? (
            members.map((m) => (
              <div key={m.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{m.users.display_name || m.users.email}</p>
                  <p className="text-xs text-gray-500">{m.users.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">{m.role}</span>
                  {canManage && m.role !== 'owner' && (
                    <select
                      value={m.role}
                      onChange={(e) => handleChangeRole(m.id, e.target.value as 'co-gm' | 'viewer')}
                      disabled={submitting}
                      className="px-2 py-1 border rounded text-sm"
                    >
                      <option value="co-gm">co-gm</option>
                      <option value="viewer">viewer</option>
                    </select>
                  )}
                  {canManage && m.role !== 'owner' && (
                    <button
                      onClick={() => handleRemove(m.id)}
                      disabled={submitting}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-600">No members yet.</p>
          )}
        </div>
      )}

      {canManage ? (
        <form onSubmit={handleInvite} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              type="email"
              placeholder="Invite by email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="col-span-2 px-3 py-2 border rounded"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'co-gm' | 'viewer')}
              className="px-3 py-2 border rounded"
            >
              <option value="co-gm">co-gm</option>
              <option value="viewer">viewer</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              {submitting ? 'Inviting...' : 'Invite'}
            </button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-gray-500">Only campaign owners can manage members.</p>
      )}
    </div>
  )
}
