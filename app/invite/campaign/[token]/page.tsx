'use server'

import Link from 'next/link'
import React from 'react'
import { createClient } from '@/lib/supabase/server'
import JoinCampaignButton from '@/components/JoinCampaignButton'

export default async function InviteCampaignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-xl p-6 bg-white rounded-lg shadow">
          <h1 className="text-xl font-semibold text-gray-900">Invalid Invite Link</h1>
          <p className="mt-2 text-sm text-gray-600">No invitation token was provided in the link.</p>
        </div>
      </div>
    )
  }

  const supabase = await createClient()

  // Look up invite link by token (no auth required to view)
  const { data: inviteLink, error: linkError } = await supabase
    .from('campaign_invite_links')
    .select('id, campaign_id, expires_at, max_uses, use_count, require_approval, is_active, created_at')
    .eq('token', token)
    .single()

  if (linkError || !inviteLink) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-xl p-6 bg-white rounded-lg shadow">
          <h1 className="text-xl font-semibold text-gray-900">Invite Link Not Found</h1>
          <p className="mt-2 text-sm text-gray-600">
            This invitation link is invalid or has been removed.
          </p>
        </div>
      </div>
    )
  }

  // Check if link is active
  if (!inviteLink.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-xl p-6 bg-white rounded-lg shadow">
          <h1 className="text-xl font-semibold text-gray-900">Invite Link Revoked</h1>
          <p className="mt-2 text-sm text-gray-600">
            This invitation link has been revoked by the campaign owner and can no longer be used.
          </p>
        </div>
      </div>
    )
  }

  // Check expiry
  const isExpired = inviteLink.expires_at ? new Date(inviteLink.expires_at) <= new Date() : false
  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-xl p-6 bg-white rounded-lg shadow">
          <h1 className="text-xl font-semibold text-gray-900">Invite Link Expired</h1>
          <p className="mt-2 text-sm text-gray-600">
            This invitation link expired on {new Date(inviteLink.expires_at!).toLocaleString()}.
          </p>
        </div>
      </div>
    )
  }

  // Check max uses
  const maxUsesReached = inviteLink.max_uses !== null && inviteLink.use_count >= inviteLink.max_uses
  if (maxUsesReached) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-xl p-6 bg-white rounded-lg shadow">
          <h1 className="text-xl font-semibold text-gray-900">Invite Link Full</h1>
          <p className="mt-2 text-sm text-gray-600">
            This invitation link has reached its maximum number of uses ({inviteLink.max_uses}).
          </p>
        </div>
      </div>
    )
  }

  // Fetch campaign details
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name, party_level')
    .eq('id', inviteLink.campaign_id)
    .single()

  // Check if user is signed in
  const { data: authData } = await supabase.auth.getUser()
  const currentUser = authData?.user ?? null

  // If signed in, check if already a member
  let isMember = false
  let hasJoinRequest = false
  let joinRequestStatus = null

  if (currentUser) {
    const { data: memberData } = await supabase
      .from('campaign_members')
      .select('id')
      .eq('campaign_id', inviteLink.campaign_id)
      .eq('user_id', currentUser.id)
      .single()

    isMember = !!memberData

    // Check for existing join request
    const { data: requestData } = await supabase
      .from('campaign_join_requests')
      .select('id, status')
      .eq('campaign_id', inviteLink.campaign_id)
      .eq('user_id', currentUser.id)
      .single()

    if (requestData) {
      hasJoinRequest = true
      joinRequestStatus = requestData.status
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full space-y-6 bg-white p-8 rounded-lg shadow-lg">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Join Campaign</h2>
          <p className="mt-2 text-lg text-gray-700">
            You&apos;ve been invited to join <strong>{campaign?.name ?? 'this campaign'}</strong>
          </p>
        </div>

        {campaign?.party_level && (
          <div className="rounded-md bg-gray-50 p-4">
            <p className="text-sm text-gray-700">
              <strong>Party Level:</strong> {campaign.party_level}
            </p>
          </div>
        )}

        <div className="rounded-md bg-blue-50 p-4 space-y-2">
          <p className="text-sm text-blue-800">
            <strong>Invite Type:</strong> {inviteLink.require_approval ? 'Approval Required' : 'Open Invite'}
          </p>
          {inviteLink.require_approval && (
            <p className="text-xs text-blue-700">
              The campaign owner will need to approve your request before you can join.
            </p>
          )}
          {inviteLink.expires_at && (
            <p className="text-sm text-blue-800">
              <strong>Expires:</strong> {new Date(inviteLink.expires_at).toLocaleString()}
            </p>
          )}
          {inviteLink.max_uses && (
            <p className="text-sm text-blue-800">
              <strong>Uses:</strong> {inviteLink.use_count} / {inviteLink.max_uses}
            </p>
          )}
        </div>

        {isMember ? (
          <div className="rounded-md bg-green-50 p-4">
            <p className="text-sm text-green-800">
              ✓ You are already a member of this campaign.
            </p>
            <Link
              href={`/gm/campaigns/${inviteLink.campaign_id}`}
              className="mt-3 inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Go to Campaign
            </Link>
          </div>
        ) : hasJoinRequest ? (
          <div className="rounded-md bg-yellow-50 p-4">
            <p className="text-sm text-yellow-800">
              {joinRequestStatus === 'pending' && '⏳ Your join request is pending approval.'}
              {joinRequestStatus === 'approved' && '✓ Your join request was approved!'}
              {joinRequestStatus === 'rejected' && '✗ Your join request was rejected.'}
            </p>
          </div>
        ) : currentUser ? (
          <JoinCampaignButton token={token} />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              To join this campaign, you need to create an account or sign in.
            </p>
            <div className="flex gap-3">
              <Link
                href="/signup"
                className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 text-center"
              >
                Create Account
              </Link>
              <Link
                href="/login"
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 text-center"
              >
                Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
