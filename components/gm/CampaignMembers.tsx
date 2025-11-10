

 'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ui/ConfirmModal'

type Member = {
	id: string
	campaign_id: string
	user_id: string
	role: 'owner' | 'co-gm' | 'viewer'
	created_at: string
	users: { id: string; email: string; display_name?: string | null }
}

type Invitation = {
	id: string
	email: string
	role: 'co-gm' | 'viewer'
	token?: string
	accepted?: boolean
	created_at?: string
	expires_at?: string
}

interface Props {
	campaignId: string
	userRole?: 'owner' | 'co-gm' | 'viewer' | null
	canManage?: boolean
	initialMembers?: Member[]
	initialInvitations?: Invitation[]
}

export default function CampaignMembers({
	campaignId,
	userRole,
	canManage,
	initialMembers,
	initialInvitations,
}: Props) {
	const router = useRouter()
	const [members, setMembers] = useState<Member[] | null>(initialMembers ?? null)
	const [invitations, setInvitations] = useState<Invitation[] | null>(initialInvitations ?? null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Invite form
	const [email, setEmail] = useState('')
	const [inviteRole, setInviteRole] = useState<'co-gm' | 'viewer'>('co-gm')
	const [submitting, setSubmitting] = useState(false)

	// Confirmation modal state
	const [modalOpen, setModalOpen] = useState(false)
	const [modalType, setModalType] = useState<'role' | 'remove' | 'resend' | 'revoke' | null>(null)
	const [modalTargetId, setModalTargetId] = useState<string | null>(null)
	const [modalTargetRole, setModalTargetRole] = useState<'co-gm' | 'viewer' | null>(null)
	const [modalMessage, setModalMessage] = useState<string>('')

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

	const fetchInvitations = useCallback(async () => {
		try {
			const res = await fetch(`/api/campaigns/${campaignId}/invitations`)
			if (!res.ok) return setInvitations([])
			const json = await res.json()
			setInvitations(json.invitations || [])
		} catch {
			setInvitations([])
		}
	}, [campaignId])

		useEffect(() => {
			// If server provided either initial members or initial invitations, do not fetch on mount.
			// This keeps tests deterministic and avoids extra network calls when server-side data was passed in.
			if (initialMembers || initialInvitations) return

			// Only fetch members when no initial data provided. Invitations are loaded via server
			// refresh (router.refresh) after mutations to avoid extra client-side calls here.
			if (!members) fetchMembers()
		}, [fetchMembers, fetchInvitations, members, invitations, initialMembers, initialInvitations])

	const refresh = useCallback(() => {
		try {
			router.refresh()
		} catch {}
	}, [router])

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
			const body = await res.json().catch(() => ({}))
			if (!res.ok) throw new Error(body.error || 'Failed to invite')
			setEmail('')
			setInviteRole('co-gm')
			// refresh server-provided data
			refresh()
		} catch (err: any) {
			setError(err?.message || 'Invite failed')
		} finally {
			setSubmitting(false)
		}
	}

	// Confirm flows
	const confirmChangeRole = (memberId: string, role: 'co-gm' | 'viewer') => {
		setModalType('role')
		setModalTargetId(memberId)
		setModalTargetRole(role)
		setModalMessage(`Change member role to ${role}?`)
		setModalOpen(true)
	}

	const performChangeRole = async () => {
		if (!modalTargetId || !modalTargetRole) return
		setModalOpen(false)
		setSubmitting(true)
		setError(null)
		try {
			const res = await fetch(`/api/campaigns/${campaignId}/members`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ memberId: modalTargetId, role: modalTargetRole }),
			})
			const body = await res.json().catch(() => ({}))
			if (!res.ok) throw new Error(body.error || 'Failed to update role')
			refresh()
		} catch (err: any) {
			setError(err?.message || 'Update failed')
		} finally {
			setSubmitting(false)
			setModalTargetId(null)
			setModalTargetRole(null)
		}
	}

	const confirmRemove = (memberId: string) => {
		setModalType('remove')
		setModalTargetId(memberId)
		setModalMessage('Remove this member from the campaign?')
		setModalOpen(true)
	}

	const performRemove = async () => {
		if (!modalTargetId) return
		setModalOpen(false)
		setSubmitting(true)
		setError(null)
		try {
			const res = await fetch(`/api/campaigns/${campaignId}/members?memberId=${modalTargetId}`, {
				method: 'DELETE',
			})
			const body = await res.json().catch(() => ({}))
			if (!res.ok) throw new Error(body.error || 'Failed to remove member')
			refresh()
		} catch (err: any) {
			setError(err?.message || 'Remove failed')
		} finally {
			setSubmitting(false)
			setModalTargetId(null)
		}
	}

	// Invitations: resend & revoke
	const confirmResendInvite = (invId: string, emailAddr?: string) => {
		setModalType('resend')
		setModalTargetId(invId)
		setModalMessage(`Re-send invite to ${emailAddr ?? 'this email'}?`)
		setModalOpen(true)
	}

	const performResendInvite = async () => {
		if (!modalTargetId) return
		setModalOpen(false)
		setSubmitting(true)
		setError(null)
		try {
			const res = await fetch(`/api/campaigns/${campaignId}/invitations/${modalTargetId}/resend`, {
				method: 'POST',
			})
			const body = await res.json().catch(() => ({}))
			if (!res.ok) throw new Error(body.error || 'Failed to resend invite')
			// refresh list
			fetchInvitations()
		} catch (err: any) {
			setError(err?.message || 'Resend failed')
		} finally {
			setSubmitting(false)
			setModalTargetId(null)
		}
	}

	const confirmRevokeInvite = (invId: string, emailAddr?: string) => {
		setModalType('revoke')
		setModalTargetId(invId)
		setModalMessage(`Revoke invitation for ${emailAddr ?? 'this email'}?`)
		setModalOpen(true)
	}

	const performRevokeInvite = async () => {
		if (!modalTargetId) return
		setModalOpen(false)
		setSubmitting(true)
		setError(null)
		try {
			const res = await fetch(`/api/campaigns/${campaignId}/invitations/${modalTargetId}`, {
				method: 'DELETE',
			})
			const body = await res.json().catch(() => ({}))
			if (!res.ok) throw new Error(body.error || 'Failed to revoke invite')
			fetchInvitations()
		} catch (err: any) {
			setError(err?.message || 'Revoke failed')
		} finally {
			setSubmitting(false)
			setModalTargetId(null)
		}
	}

	return (
		<div className="bg-white shadow rounded-lg p-6 mb-6">
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-lg font-semibold text-gray-900">Campaign Members</h2>
				<p className="text-sm text-gray-600">Role: {userRole ?? '—'}</p>
			</div>

			{error && <div className="mb-4 text-sm text-red-700 bg-red-50 px-3 py-2 rounded">{error}</div>}

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
											onChange={(e) => confirmChangeRole(m.id, e.target.value as 'co-gm' | 'viewer')}
											disabled={submitting}
											className="px-2 py-1 border rounded text-sm"
										>
											<option value="co-gm">co-gm</option>
											<option value="viewer">viewer</option>
										</select>
									)}
									{canManage && m.role !== 'owner' && (
										<button
											onClick={() => confirmRemove(m.id)}
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

			{/* Invitations list */}
			<div className="mb-4">
				<h3 className="text-sm font-medium text-gray-800 mb-2">Pending Invitations</h3>
				<div className="space-y-2">
					{invitations && invitations.length > 0 ? (
						invitations.map((inv) => (
							<div key={inv.id} className="flex items-center justify-between">
								<div>
									<p className="text-sm text-gray-900">{inv.email}</p>
									<p className="text-xs text-gray-500">Role: {inv.role} • Sent {inv.created_at ? new Date(inv.created_at).toLocaleString() : '—'}</p>
									{inv.expires_at && (
										<p className="text-xs text-gray-500">Expires: {new Date(inv.expires_at).toLocaleString()}</p>
									)}
								</div>
								<div className="flex items-center gap-3">
									{(() => {
										const isExpired = inv.expires_at ? new Date(inv.expires_at) < new Date() : false
										return (
											<button
												onClick={() => confirmResendInvite(inv.id, inv.email)}
												disabled={submitting || isExpired}
												className={`text-sm ${isExpired ? 'text-gray-400' : 'text-blue-600 hover:text-blue-800'}`}
											>
												{isExpired ? 'Expired' : 'Resend'}
											</button>
										)
									})()}
									<button
										onClick={() => confirmRevokeInvite(inv.id, inv.email)}
										disabled={submitting}
										className="text-sm text-red-600 hover:text-red-800"
									>
										Revoke
									</button>
								</div>
							</div>
						))
					) : (
						<p className="text-sm text-gray-600">No pending invitations.</p>
					)}
				</div>
			</div>

			{/* Shared accessible confirmation modal */}
			<ConfirmModal
				isOpen={modalOpen}
				title="Confirmation"
				message={modalMessage}
				onConfirm={() => {
					if (modalType === 'role') performChangeRole()
					else if (modalType === 'remove') performRemove()
					else if (modalType === 'resend') performResendInvite()
					else if (modalType === 'revoke') performRevokeInvite()
				}}
				onCancel={() => {
					setModalOpen(false)
					setModalTargetId(null)
					setModalTargetRole(null)
				}}
				confirmTestId="confirm-modal-confirm"
				cancelTestId="confirm-modal-cancel"
			/>

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

