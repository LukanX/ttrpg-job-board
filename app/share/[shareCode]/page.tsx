import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { nanoid } from 'nanoid'
import type { Campaign, Job, Organization, MissionType } from '@/types/database'
import JobVotingCard from './JobVotingCard'

interface Props {
  params: Promise<{
    shareCode: string
  }>
}

export default async function SharePage({ params }: Props) {
  const { shareCode } = await params
  const supabase = await createClient()
  const cookieStore = await cookies()

  // Get or create anonymous session ID for voting
  let sessionId = cookieStore.get('session_id')?.value
  if (!sessionId) {
    sessionId = nanoid(32)
    // Note: We'll set this cookie client-side since we can't set cookies in Server Components
  }

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch campaign by share code
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('share_code', shareCode)
    .single()

  if (campaignError || !campaign) {
    notFound()
  }

  // Fetch active jobs for this campaign
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('*')
    .eq('campaign_id', campaign.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (jobsError) {
    console.error('Error fetching jobs:', jobsError)
  }

  const activeJobs = (jobs || []) as Job[]

  // Fetch organizations and mission types for context
  const [orgsResult, typesResult] = await Promise.all([
    supabase
      .from('organizations')
      .select('*')
      .eq('campaign_id', campaign.id),
    supabase
      .from('mission_types')
      .select('*')
      .eq('campaign_id', campaign.id),
  ])

  const organizations = (orgsResult.data || []) as Organization[]
  const missionTypes = (typesResult.data || []) as MissionType[]

  // Fetch votes for these jobs
  const jobIds = activeJobs.map((j) => j.id)
  const userVotes: Record<string, number> = {}
  const voteCounts: Record<string, { upvotes: number; downvotes: number }> = {}

  if (jobIds.length > 0) {
    // Get vote counts for all jobs
    const { data: allVotes } = await supabase
      .from('votes')
      .select('job_id, vote_value')
      .in('job_id', jobIds)

    if (allVotes) {
      allVotes.forEach((vote) => {
        if (!voteCounts[vote.job_id]) {
          voteCounts[vote.job_id] = { upvotes: 0, downvotes: 0 }
        }
        if (vote.vote_value === 1) {
          voteCounts[vote.job_id].upvotes++
        } else if (vote.vote_value === -1) {
          voteCounts[vote.job_id].downvotes++
        }
      })
    }

    // Get user's votes if authenticated, otherwise session votes
    if (user) {
      const { data: votes } = await supabase
        .from('votes')
        .select('job_id, vote_value')
        .in('job_id', jobIds)
        .eq('user_id', user.id)

      if (votes) {
        votes.forEach((vote) => {
          userVotes[vote.job_id] = vote.vote_value
        })
      }
    } else {
      // For anonymous users, we'll handle this client-side with session storage
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold text-gray-900">{campaign.name}</h1>
              <p className="mt-1 text-sm text-gray-600">
                Party Level {campaign.party_level} • Available Missions
              </p>
            </div>
            {user && (
              <div className="mt-4 flex md:mt-0 md:ml-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  Signed in as {user.email}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Vote for Your Next Mission</h2>
          <p className="text-gray-600">
            Review the available missions and vote for the ones you'd like to play. Your votes help the GM choose the next adventure!
          </p>
        </div>

        {activeJobs.length > 0 ? (
          <div className="space-y-6">
            {activeJobs.map((job) => {
              const org = organizations.find((o) => o.id === job.organization_id)
              const missionType = missionTypes.find((m) => m.id === job.mission_type_id)
              const votes = voteCounts[job.id] || { upvotes: 0, downvotes: 0 }
              const userVote = userVotes[job.id] || 0

              return (
                <JobVotingCard
                  key={job.id}
                  job={job}
                  organization={org}
                  missionType={missionType}
                  upvotes={votes.upvotes}
                  downvotes={votes.downvotes}
                  userVote={userVote}
                  userId={user?.id}
                  sessionId={sessionId}
                />
              )
            })}
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <div className="text-6xl mb-4">🎲</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No missions available yet</h3>
            <p className="text-gray-600">
              The GM hasn't posted any missions yet. Check back soon for exciting adventures!
            </p>
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">How Voting Works</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Vote for missions you'd like to play by clicking the upvote (👍) button</li>
            <li>• Downvote missions you're less interested in with the downvote (👎) button</li>
            <li>• You can change your vote at any time</li>
            <li>• The GM will see the vote totals when deciding which mission to run next</li>
            {!user && (
              <li className="mt-3 font-medium">
                💡 Tip: <a href="/login" className="underline">Sign in</a> to ensure your votes are saved across devices
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}
