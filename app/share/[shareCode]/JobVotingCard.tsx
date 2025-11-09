'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Job, Organization, MissionType } from '@/types/database'

interface Props {
  job: Job
  organization?: Organization
  missionType?: MissionType
  upvotes: number
  downvotes: number
  userVote: number
  userId?: string
  sessionId?: string
}

export default function JobVotingCard({
  job,
  organization,
  missionType,
  upvotes: initialUpvotes,
  downvotes: initialDownvotes,
  userVote: initialUserVote,
  userId,
  sessionId,
}: Props) {
  const router = useRouter()
  const [upvotes, setUpvotes] = useState(initialUpvotes)
  const [downvotes, setDownvotes] = useState(initialDownvotes)
  const [userVote, setUserVote] = useState(initialUserVote)
  const [isVoting, setIsVoting] = useState(false)
  const [showFullDescription, setShowFullDescription] = useState(false)

  // Load anonymous votes from session storage
  useEffect(() => {
    if (!userId && sessionId) {
      const stored = sessionStorage.getItem(`vote_${job.id}`)
      if (stored) {
        const vote = parseInt(stored, 10)
        if (vote === 1 || vote === -1) {
          setUserVote(vote)
        }
      }
    }
  }, [job.id, userId, sessionId])

  // Set session cookie if not authenticated
  useEffect(() => {
    if (!userId && sessionId) {
      document.cookie = `session_id=${sessionId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
    }
  }, [userId, sessionId])

  const handleVote = async (voteValue: 1 | -1) => {
    if (isVoting) return

    const newVote = userVote === voteValue ? 0 : voteValue
    const oldVote = userVote

    // Optimistic update
    setUserVote(newVote)
    if (oldVote === 1) setUpvotes((v) => v - 1)
    if (oldVote === -1) setDownvotes((v) => v - 1)
    if (newVote === 1) setUpvotes((v) => v + 1)
    if (newVote === -1) setDownvotes((v) => v + 1)

    setIsVoting(true)

    try {
      const response = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          voteValue: newVote,
          sessionId: userId ? undefined : sessionId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to vote')
      }

      // Store anonymous vote in session storage
      if (!userId && sessionId) {
        if (newVote === 0) {
          sessionStorage.removeItem(`vote_${job.id}`)
        } else {
          sessionStorage.setItem(`vote_${job.id}`, String(newVote))
        }
      }

      // Refresh to get updated vote counts from server
      router.refresh()
    } catch (error) {
      // Revert optimistic update on error
      setUserVote(oldVote)
      if (newVote === 1) setUpvotes((v) => v - 1)
      if (newVote === -1) setDownvotes((v) => v - 1)
      if (oldVote === 1) setUpvotes((v) => v + 1)
      if (oldVote === -1) setDownvotes((v) => v + 1)
      console.error('Error voting:', error)
    } finally {
      setIsVoting(false)
    }
  }

  const getDifficultyStars = (difficulty: number) => {
    return '★'.repeat(difficulty) + '☆'.repeat(10 - difficulty)
  }

  const netVotes = upvotes - downvotes
  const totalVotes = upvotes + downvotes

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-2">{job.title}</h3>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              {organization && <span>📍 {organization.name}</span>}
              {missionType && <span>🎯 {missionType.name}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <span className="text-yellow-500" title={`Difficulty: ${job.difficulty}/10`}>
              {getDifficultyStars(job.difficulty)}
            </span>
          </div>
        </div>

        {/* Description */}
        <div className="mb-4">
          <p className={`text-gray-700 ${showFullDescription ? '' : 'line-clamp-3'}`}>
            {job.description}
          </p>
          {job.description.length > 200 && (
            <button
              onClick={() => setShowFullDescription(!showFullDescription)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium mt-2"
            >
              {showFullDescription ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>

        {/* Reward */}
        {job.reward && (
          <div className="mb-4 inline-flex items-center px-3 py-1 rounded-full bg-yellow-50 text-yellow-800 text-sm font-medium">
            💰 {job.reward}
          </div>
        )}

        {/* Voting Section */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="flex items-center gap-4">
            {/* Upvote Button */}
            <button
              onClick={() => handleVote(1)}
              disabled={isVoting}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                userVote === 1
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-green-100 hover:text-green-700'
              } disabled:opacity-50`}
              title="Vote for this mission"
            >
              <span className="text-lg">👍</span>
              <span>{upvotes}</span>
            </button>

            {/* Downvote Button */}
            <button
              onClick={() => handleVote(-1)}
              disabled={isVoting}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                userVote === -1
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-red-100 hover:text-red-700'
              } disabled:opacity-50`}
              title="Vote against this mission"
            >
              <span className="text-lg">👎</span>
              <span>{downvotes}</span>
            </button>
          </div>

          {/* Vote Score */}
          <div className="text-right">
            <div
              className={`text-2xl font-bold ${
                netVotes > 0 ? 'text-green-600' : netVotes < 0 ? 'text-red-600' : 'text-gray-600'
              }`}
            >
              {netVotes > 0 ? '+' : ''}
              {netVotes}
            </div>
            <div className="text-xs text-gray-500">{totalVotes} total votes</div>
          </div>
        </div>
      </div>
    </div>
  )
}
