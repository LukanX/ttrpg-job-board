'use server'

import Link from 'next/link'
import React from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/server'

const AcceptInviteButton = dynamic(() => import('@/components/AcceptInviteButton'), { ssr: false })

type Props = {
  searchParams?: { token?: string }
}

export default async function InvitePage({ searchParams }: Props) {
  const token = searchParams?.token

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-xl p-6 bg-white rounded shadow">
          <h1 className="text-xl font-semibold">Invalid invitation</h1>
          <p className="mt-2 text-sm text-gray-600">No invitation token was provided in the link.</p>
        </div>
      </div>
    )
  }

  const supabase = await createClient()

  // Look up invitation by token
  const { data: invData, error: invErr } = await supabase
    .from('campaign_invitations')
    .select('id, email, role, campaign_id, accepted, created_at, expires_at')
    .eq('token', token)
    .single()

  if (invErr || !invData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-xl p-6 bg-white rounded shadow">
          <h1 className="text-xl font-semibold">Invitation not found</h1>
          <p className="mt-2 text-sm text-gray-600">This invitation link is invalid or has already been used.</p>
        </div>
      </div>
    )
  }

  const campaignId = invData.campaign_id
  const { data: campData } = await supabase.from('campaigns').select('id, name').eq('id', campaignId).single()

  // Check signed-in user (server-side) to display accept CTA when appropriate
  const { data: authData } = await supabase.auth.getUser()
  const currentUser = authData?.user ?? null

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full space-y-6 bg-white p-6 rounded shadow">
        <div>
          <h2 className="text-2xl font-semibold">You're invited</h2>
          <p className="mt-2 text-sm text-gray-600">You were invited to join the campaign <strong>{campData?.name ?? campaignId}</strong>.</p>
        </div>

        <div className="rounded-md bg-gray-50 p-4">
          <p className="text-sm">Invited email: <strong>{invData.email}</strong></p>
          <p className="text-sm mt-1">Role: <strong>{invData.role}</strong></p>
          <p className="text-sm mt-1">Sent: <strong>{invData.created_at ? new Date(invData.created_at).toLocaleString() : '—'}</strong></p>
          {invData.expires_at && (
            <p className="text-sm mt-1">Expires: <strong>{new Date(invData.expires_at).toLocaleString()}</strong></p>
          )}
          {invData.expires_at && new Date(invData.expires_at) < new Date() && (
            <p className="text-sm mt-2 text-red-700">This invitation has expired and can no longer be used.</p>
          )}
          {invData.accepted && <p className="text-sm mt-2 text-green-700">This invitation has already been accepted.</p>}
        </div>

        <div className="space-y-3">
          <p className="text-sm text-gray-700">To accept, create an account using the same email address, or sign in if you already have an account.</p>

          {currentUser && currentUser.email === invData.email && !invData.accepted && !(invData.expires_at && new Date(invData.expires_at) < new Date()) ? (
            // Client-side button to POST accept
            <div>
              {/* dynamically load client component */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <script type="module" />
              <div id="accept-cta">
                <AcceptInviteButton token={token} />
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <Link
                href={`/signup?email=${encodeURIComponent(invData.email)}`}
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                Create account
              </Link>

              <Link href={`/login`} className="px-4 py-2 border rounded">
                Sign in
              </Link>
            </div>
          )}

          <p className="text-xs text-gray-500">By signing up with the invited email the system will automatically add you to the campaign.</p>
        </div>
      </div>
    </div>
  )
}
