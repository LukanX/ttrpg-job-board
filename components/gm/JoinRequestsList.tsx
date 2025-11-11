'use client'

import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ui/ConfirmModal'

type JoinRequest = {
  id: string
  campaign_id: string
  user_id: string
  invite_link_id: string | null
  status: 'pending' | 'approved' | 'rejected'
  requested_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  users?: {
    id: string
    email: string
    display_name?: string | null
  } | null
}

interface Props {
  campaignId: string
  initialRequests?: JoinRequest[]
}

export default function JoinRequestsList({ campaignId, initialRequests }: Props) {
  const router = useRouter()
  const [requests, setRequests] = useState<JoinRequest[]>(initialRequests ?? [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalAction, setModalAction] = useState<'approve' | 'reject' | null>(null)
  const [modalRequestId, setModalRequestId] = useState<string | null>(null)
  const [modalUserEmail, setModalUserEmail] = useState<string>('')

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/join-requests`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to fetch join requests')
      }
      const json = await res.json()
      setRequests(json.joinRequests || [])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err ?? 'Error')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  const confirmAction = (requestId: string, action: 'approve' | 'reject', userEmail: string) => {
    setModalRequestId(requestId)
    setModalAction(action)
    setModalUserEmail(userEmail)
    setModalOpen(true)
  }

  const handleAction = async () => {
    if (!modalRequestId || !modalAction) return
    setModalOpen(false)
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/join-requests/${modalRequestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: modalAction }),
      })

      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(body.error || `Failed to ${modalAction} join request`)
      }

      router.refresh()
      fetchRequests()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err ?? 'Action failed')
      setError(msg)
    } finally {
      setLoading(false)
      setModalRequestId(null)
      setModalAction(null)
      setModalUserEmail('')
    }
  }

  const pendingRequests = requests.filter((r) => r.status === 'pending')
  const reviewedRequests = requests.filter((r) => r.status !== 'pending')

  return (
    <div className="bg-white shadow rounded-lg p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Join Requests</h2>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 px-3 py-2 rounded">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-600">Loading join requests...</p>
      ) : (
        <>
          {/* Pending Requests */}
          {pendingRequests.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-800 mb-3">
                Pending ({pendingRequests.length})
              </h3>
              <div className="space-y-3">
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {request.users?.display_name || request.users?.email || 'Unknown user'}
                      </p>
                      <p className="text-xs text-gray-600">{request.users?.email}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Requested: {new Date(request.requested_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          confirmAction(request.id, 'approve', request.users?.email || 'this user')
                        }
                        disabled={loading}
                        className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() =>
                          confirmAction(request.id, 'reject', request.users?.email || 'this user')
                        }
                        disabled={loading}
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reviewed Requests */}
          {reviewedRequests.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-800 mb-3">
                Previously Reviewed ({reviewedRequests.length})
              </h3>
              <div className="space-y-2">
                {reviewedRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {request.users?.display_name || request.users?.email || 'Unknown user'}
                      </p>
                      <p className="text-xs text-gray-600">{request.users?.email}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Reviewed: {request.reviewed_at ? new Date(request.reviewed_at).toLocaleString() : '—'}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-medium px-3 py-1 rounded ${
                        request.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {request.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {requests.length === 0 && (
            <p className="text-sm text-gray-600">No join requests yet.</p>
          )}
        </>
      )}

      <ConfirmModal
        isOpen={modalOpen}
        title={modalAction === 'approve' ? 'Approve Join Request' : 'Reject Join Request'}
        message={
          modalAction === 'approve'
            ? `Approve ${modalUserEmail} to join this campaign?`
            : `Reject ${modalUserEmail}'s request to join?`
        }
        onConfirm={handleAction}
        onCancel={() => {
          setModalOpen(false)
          setModalRequestId(null)
          setModalAction(null)
          setModalUserEmail('')
        }}
      />
    </div>
  )
}
