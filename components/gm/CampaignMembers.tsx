
 'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ui/ConfirmModal'
import InviteLinksManager from '@/components/gm/InviteLinksManager'
import JoinRequestsList from '@/components/gm/JoinRequestsList'

type Member = {
	id: string
	campaign_id: string
	user_id: string
	role: 'owner' | 'co-gm' | 'viewer'
	created_at: string
	character_name?: string | null
	// users can be null if the referenced user was removed; make nullable
	users?: { id: string; email: string; display_name?: string | null } | null
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
	userRole?: 'owner' | 'co-gm' | 'viewer' | null
	canManage?: boolean
	initialMembers?: Member[]
	initialInvitations?: Invitation[]
	initialInviteLinks?: InviteLink[]
	initialJoinRequests?: JoinRequest[]
	currentUserId?: string // Add current user ID to know which member is the current user
}

export default function CampaignMembers({
	campaignId,
	userRole,
	canManage,
	initialMembers,
	initialInvitations,
	initialInviteLinks,
	initialJoinRequests,
	currentUserId,
}: Props) {
	const router = useRouter()
	const [members, setMembers] = useState<Member[] | null>(initialMembers ?? null)
	const [invitations, setInvitations] = useState<Invitation[] | null>(initialInvitations ?? null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Character assignment state
	const [editingCharacter, setEditingCharacter] = useState<string | null>(null)
	const [characterName, setCharacterName] = useState('')
	const [savingCharacter, setSavingCharacter] = useState(false)

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
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err ?? 'Error')
				setError(msg)
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
					} catch (err: unknown) {
					void err
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
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err ?? 'Invite failed')
				setError(msg)
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
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err ?? 'Update failed')
				setError(msg)
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
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err ?? 'Remove failed')
				setError(msg)
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
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err ?? 'Resend failed')
				setError(msg)
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
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err ?? 'Revoke failed')
				setError(msg)
		} finally {
			setSubmitting(false)
			setModalTargetId(null)
		}
	}

	// Character assignment
	const startEditingCharacter = (memberId: string, currentCharacter?: string | null) => {
		setEditingCharacter(memberId)
		setCharacterName(currentCharacter || '')
	}

	const cancelEditingCharacter = () => {
		setEditingCharacter(null)
		setCharacterName('')
	}

	const saveCharacterName = async () => {
		setSavingCharacter(true)
		setError(null)
		try {
			const res = await fetch(`/api/campaigns/${campaignId}/members/me/character`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ characterName: characterName.trim() || null }),
			})

			const body = await res.json().catch(() => ({}))

			if (!res.ok) {
				throw new Error(body.error || 'Failed to update character name')
			}

			// Update local state
			setMembers((prev) => 
				prev ? prev.map((m) => 
					m.user_id === currentUserId 
						? { ...m, character_name: characterName.trim() || null }
						: m
				) : prev
			)

			setEditingCharacter(null)
			setCharacterName('')
			router.refresh()
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err ?? 'Update failed')
			setError(msg)
		} finally {
			setSavingCharacter(false)
		}
	}

	return (
		<div className="space-y-6">
			{/* Current Members Section */}
			<div className="bg-white shadow rounded-lg p-6">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-semibold text-gray-900">Campaign Members</h2>
					<p className="text-sm text-gray-600">Your Role: {userRole ?? '—'}</p>
				</div>

				{error && <div className="mb-4 text-sm text-red-700 bg-red-50 px-3 py-2 rounded">{error}</div>}

				{loading ? (
					<p className="text-sm text-gray-600">Loading members…</p>
				) : (
					<div className="space-y-3">
						{members && members.length > 0 ? (
							members.map((m) => {
								const isCurrentUser = m.user_id === currentUserId
								const isEditingThisCharacter = editingCharacter === m.id
								
								return (
									<div key={m.id} className="flex items-start justify-between p-3 bg-gray-50 rounded">
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2">
												<p className="font-medium text-gray-900">
													{m.users?.display_name || m.users?.email || 'Unknown user'}
												</p>
												<span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-700 rounded">
													{m.role}
												</span>
											</div>
											<p className="text-xs text-gray-500">{m.users?.email ?? '—'}</p>
											
											{/* Character Assignment */}
											<div className="mt-2">
												{isEditingThisCharacter ? (
													<div className="flex items-center gap-2">
														<input
															type="text"
															value={characterName}
															onChange={(e) => setCharacterName(e.target.value)}
															placeholder="Character name"
															className="text-sm px-2 py-1 border rounded flex-1 max-w-xs"
															autoFocus
															onKeyDown={(e) => {
																if (e.key === 'Enter') saveCharacterName()
																if (e.key === 'Escape') cancelEditingCharacter()
															}}
														/>
														<button
															onClick={saveCharacterName}
															disabled={savingCharacter}
															className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
														>
															{savingCharacter ? 'Saving...' : 'Save'}
														</button>
														<button
															onClick={cancelEditingCharacter}
															disabled={savingCharacter}
															className="text-xs px-2 py-1 border rounded hover:bg-gray-100"
														>
															Cancel
														</button>
													</div>
												) : (
													<div className="flex items-center gap-2">
														{m.character_name ? (
															<p className="text-sm text-gray-700">
																🎭 Playing: <span className="font-medium">{m.character_name}</span>
															</p>
														) : (
															<p className="text-sm text-gray-400 italic">No character assigned</p>
														)}
														{isCurrentUser && (
															<button
																onClick={() => startEditingCharacter(m.id, m.character_name)}
																className="text-xs text-blue-600 hover:text-blue-800"
															>
																{m.character_name ? 'Edit' : 'Set Character'}
															</button>
														)}
													</div>
												)}
											</div>
										</div>
										
										{canManage && m.role !== 'owner' && (
											<div className="flex items-center gap-2 ml-3">
												<select
													value={m.role}
													onChange={(e) => confirmChangeRole(m.id, e.target.value as 'co-gm' | 'viewer')}
													disabled={submitting}
													className="px-2 py-1 border rounded text-sm"
												>
													<option value="co-gm">co-gm</option>
													<option value="viewer">viewer</option>
												</select>
												<button
													onClick={() => confirmRemove(m.id)}
													disabled={submitting}
													className="text-sm text-red-600 hover:text-red-800"
												>
													Remove
												</button>
											</div>
										)}
									</div>
								)
							})
						) : (
							<p className="text-sm text-gray-600">No members yet.</p>
						)}
					</div>
				)}
			</div>

			{/* Invitation Management Section - Only for owners */}
			{canManage && (
				<div className="bg-white shadow rounded-lg p-6">
					<h2 className="text-lg font-semibold text-gray-900 mb-4">Invite Members</h2>
					
					{/* Shareable Link Invites */}
					<div className="mb-6">
						<h3 className="text-sm font-semibold text-gray-800 mb-2">Shareable Invite Links</h3>
						<p className="text-xs text-gray-600 mb-3">
							Create shareable links to post on Discord, forums, etc. Set expiry, usage limits, and approval requirements.
						</p>
						<InviteLinksManager 
							campaignId={campaignId}
							initialLinks={initialInviteLinks}
						/>
					</div>

					{/* Email Invites */}
					<div className="border-t pt-6">
						<h3 className="text-sm font-semibold text-gray-800 mb-2">Email Invitations</h3>
						<p className="text-xs text-gray-600 mb-3">
							Send a direct invitation to a specific email address. They'll receive an email with a personal invite link.
						</p>
						
						<form onSubmit={handleInvite} className="space-y-3">
							<div className="grid grid-cols-1 md:grid-cols-3 gap-2">
								<input
									type="email"
									placeholder="email@example.com"
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

							<button
								type="submit"
								disabled={submitting}
								className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700"
							>
								{submitting ? 'Sending...' : 'Send Email Invite'}
							</button>
						</form>

						{/* Pending Email Invitations */}
						{invitations && invitations.length > 0 && (
							<div className="mt-4">
								<h4 className="text-xs font-medium text-gray-700 mb-2">Pending Email Invitations</h4>
								<div className="space-y-2">
									{invitations.map((inv) => (
										<div key={inv.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
											<div>
												<p className="text-gray-900">{inv.email}</p>
												<p className="text-xs text-gray-500">Role: {inv.role} • Sent {inv.created_at ? new Date(inv.created_at).toLocaleString() : '—'}</p>
												{inv.expires_at && (
													<p className="text-xs text-gray-500">Expires: {new Date(inv.expires_at).toLocaleString()}</p>
												)}
											</div>
											<div className="flex items-center gap-2">
												{(() => {
													const isExpired = inv.expires_at ? new Date(inv.expires_at) < new Date() : false
													return (
														<button
															onClick={() => confirmResendInvite(inv.id, inv.email)}
															disabled={submitting || isExpired}
															className={`text-xs ${isExpired ? 'text-gray-400' : 'text-blue-600 hover:text-blue-800'}`}
														>
															{isExpired ? 'Expired' : 'Resend'}
														</button>
													)
												})()}
												<button
													onClick={() => confirmRevokeInvite(inv.id, inv.email)}
													disabled={submitting}
													className="text-xs text-red-600 hover:text-red-800"
												>
													Revoke
												</button>
											</div>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Join Requests Section - Only for owners */}
			{canManage && (
				<JoinRequestsList
					campaignId={campaignId}
					initialRequests={initialJoinRequests}
				/>
			)}

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
		</div>
	)
}
