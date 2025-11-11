'use client'

import { useState } from 'react'
import type { Organization, MissionType, Job, CampaignMember, CampaignMemberRole } from '@/types/database'
import OrganizationsTab from './tabs/OrganizationsTab'
import MissionTypesTab from './tabs/MissionTypesTab'
import JobsTab from './tabs/JobsTab'
import CampaignMembers from '@/components/gm/CampaignMembers'

interface Props {
  campaignId: string
  organizations: Organization[]
  missionTypes: MissionType[]
  jobs: Job[]
  initialMembers?: CampaignMember[]
  // Invitation shape expected by CampaignMembers component
  initialInvitations?: Array<{
    id: string
    email: string
    role: 'co-gm' | 'viewer'
    token?: string
    accepted?: boolean
    created_at?: string
    expires_at?: string
  }>
  initialInviteLinks?: Array<{
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
  }>
  initialJoinRequests?: Array<{
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
  }>
}

type TabType = 'jobs' | 'organizations' | 'mission-types' | 'members'

export default function CampaignTabs({
  campaignId,
  organizations,
  missionTypes,
  jobs,
  initialMembers,
  initialInvitations,
  initialInviteLinks,
  initialJoinRequests,
  userRole,
  canManage,
  membersCount,
  currentUserId,
}: Props & { userRole?: 'owner' | 'co-gm' | 'viewer' | null; canManage?: boolean; membersCount?: number; currentUserId?: string }) {
  const [activeTab, setActiveTab] = useState<TabType>('jobs')

  const tabs = [
    { id: 'jobs' as TabType, name: 'Jobs', count: jobs.length },
    { id: 'organizations' as TabType, name: 'Organizations', count: organizations.length },
    { id: 'mission-types' as TabType, name: 'Mission Types', count: missionTypes.length },
    { id: 'members' as TabType, name: 'Members', count: membersCount ?? 0 },
  ]

  return (
    <div>
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.name}
              <span className="ml-2 py-0.5 px-2 rounded-full bg-gray-100 text-gray-600 text-xs">
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'jobs' && (
          <JobsTab
            campaignId={campaignId}
            jobs={jobs}
            organizations={organizations}
            missionTypes={missionTypes}
          />
        )}
        {activeTab === 'organizations' && (
          <OrganizationsTab campaignId={campaignId} organizations={organizations} />
        )}
        {activeTab === 'mission-types' && (
          <MissionTypesTab campaignId={campaignId} missionTypes={missionTypes} />
        )}
        {activeTab === 'members' && (
          <>
            <CampaignMembers
              campaignId={campaignId}
              userRole={userRole as CampaignMemberRole | null}
              canManage={!!canManage}
              initialMembers={initialMembers}
              initialInvitations={initialInvitations}
              initialInviteLinks={initialInviteLinks}
              initialJoinRequests={initialJoinRequests}
              currentUserId={currentUserId}
            />
          </>
        )}
      </div>
    </div>
  )
}
