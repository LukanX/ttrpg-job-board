'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import RegenerateJobModal from '@/components/gm/RegenerateJobModal'
import type { Organization, MissionType } from '@/types/database'

interface RegenerateJobButtonProps {
  campaignId: string
  jobId: string
  currentDifficulty: number
  currentOrganizationId?: string | null
  currentMissionTypeId?: string | null
  organizations: Organization[]
  missionTypes: MissionType[]
}

export default function RegenerateJobButton({
  campaignId,
  jobId,
  currentDifficulty,
  currentOrganizationId,
  currentMissionTypeId,
  organizations,
  missionTypes,
}: RegenerateJobButtonProps) {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-md border border-purple-200"
      >
        <RefreshCw className="h-4 w-4" />
        Regenerate
      </button>

      {showModal && (
        <RegenerateJobModal
          campaignId={campaignId}
          jobId={jobId}
          currentDifficulty={currentDifficulty}
          currentOrganizationId={currentOrganizationId}
          currentMissionTypeId={currentMissionTypeId}
          organizations={organizations}
          missionTypes={missionTypes}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
