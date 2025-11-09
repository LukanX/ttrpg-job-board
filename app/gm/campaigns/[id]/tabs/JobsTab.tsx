'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Job, Organization, MissionType } from '@/types/database'

interface Props {
  campaignId: string
  jobs: Job[]
  organizations: Organization[]
  missionTypes: MissionType[]
}

export default function JobsTab({ campaignId, jobs, organizations, missionTypes }: Props) {
  const router = useRouter()

  const getStatusBadge = (status: Job['status']) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      archived: 'bg-red-100 text-red-800',
    }
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colors[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const getDifficultyStars = (difficulty: number) => {
    return '★'.repeat(difficulty) + '☆'.repeat(10 - difficulty)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Mission Jobs</h2>
        <button
          onClick={() => router.push(`/gm/campaigns/${campaignId}/jobs/generate`)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          ✨ Generate Job
        </button>
      </div>

      {jobs.length > 0 ? (
        <div className="space-y-4">
          {jobs.map((job) => {
            const org = organizations.find((o) => o.id === job.organization_id)
            const missionType = missionTypes.find((m) => m.id === job.mission_type_id)

            return (
              <div key={job.id} className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{job.title}</h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                      {org && <span>📍 {org.name}</span>}
                      {missionType && <span>🎯 {missionType.name}</span>}
                    </div>
                  </div>
                  {getStatusBadge(job.status)}
                </div>

                <p className="text-gray-700 mb-3 line-clamp-2">{job.description}</p>

                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-4">
                    <span className="text-yellow-500" title={`Difficulty: ${job.difficulty}/10`}>
                      {getDifficultyStars(job.difficulty)}
                    </span>
                    {job.reward && <span className="text-gray-600">💰 {job.reward}</span>}
                  </div>
                  <button
                    onClick={() => router.push(`/gm/campaigns/${campaignId}/jobs/${job.id}`)}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View Details →
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs yet</h3>
          <p className="text-gray-600 mb-6">Generate your first mission job with AI</p>
          <button
            onClick={() => router.push(`/gm/campaigns/${campaignId}/jobs/generate`)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            ✨ Generate Job
          </button>
        </div>
      )}
    </div>
  )
}
