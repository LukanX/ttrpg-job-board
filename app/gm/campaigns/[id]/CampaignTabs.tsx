'use client'

import { useState } from 'react'
import type { Organization, MissionType, Job } from '@/types/database'
import OrganizationsTab from './tabs/OrganizationsTab'
import MissionTypesTab from './tabs/MissionTypesTab'
import JobsTab from './tabs/JobsTab'
import CampaignMembers from '@/components/gm/CampaignMembers'

interface Props {
  campaignId: string
  organizations: Organization[]
  missionTypes: MissionType[]
  jobs: Job[]
  initialMembers?: any[]
  initialInvitations?: any[]
}

type TabType = 'jobs' | 'organizations' | 'mission-types' | 'members'

export default function CampaignTabs({
  campaignId,
  organizations,
  missionTypes,
  jobs,
  initialMembers,
  initialInvitations,
  userRole,
  canManage,
  membersCount,
}: Props & { userRole?: 'owner' | 'co-gm' | 'viewer' | null; canManage?: boolean; membersCount?: number }) {
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
          <CampaignMembers
            campaignId={campaignId}
            userRole={userRole as any}
            canManage={!!canManage}
            initialMembers={initialMembers}
            initialInvitations={initialInvitations}
          />
        )}
      </div>
    </div>
  )
}
