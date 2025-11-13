import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import JobForm from '@/components/gm/JobForm'
import { createClient } from '@/lib/supabase/client'
import type { Job, Organization, MissionType } from '@/types/database'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

describe('JobForm', () => {
  const mockRouter = {
    push: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
  }

  const mockOrganizations: Organization[] = [
    {
      id: 'org-1',
      campaign_id: 'campaign-1',
      name: 'Starfinder Society',
      description: 'Test org',
      faction_type: 'alliance',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
  ]

  const mockMissionTypes: MissionType[] = [
    {
      id: 'type-1',
      campaign_id: 'campaign-1',
      name: 'Rescue',
      description: 'Test type',
      tags: ['action'],
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
  ]

  const mockJob: Job = {
    id: 'job-1',
    campaign_id: 'campaign-1',
    organization_id: 'org-1',
    mission_type_id: 'type-1',
    title: 'Test Job',
    description: 'Test description',
    difficulty: 5,
    reward: '1000 credits',
    status: 'active',
    gm_notes: 'Secret notes',
    llm_raw_response: null,
    created_by: 'user-1',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    global.fetch = jest.fn()
  })

  it('renders the form with empty values for new job', () => {
    render(
      <JobForm
        campaignId="campaign-1"
        organizations={mockOrganizations}
        missionTypes={mockMissionTypes}
      />
    )

    expect(screen.getByLabelText(/job title/i)).toHaveValue('')
    expect(screen.getByLabelText(/description/i)).toHaveValue('')
    expect(screen.getByLabelText(/difficulty/i)).toHaveValue(5)
    expect(screen.getByText('Create Job')).toBeInTheDocument()
  })

  it('renders the form with existing job values for edit', () => {
    render(
      <JobForm
        campaignId="campaign-1"
        job={mockJob}
        organizations={mockOrganizations}
        missionTypes={mockMissionTypes}
      />
    )

    expect(screen.getByLabelText(/job title/i)).toHaveValue('Test Job')
    expect(screen.getByLabelText(/description/i)).toHaveValue('Test description')
    expect(screen.getByLabelText(/difficulty/i)).toHaveValue(5)
    expect(screen.getByLabelText(/reward/i)).toHaveValue('1000 credits')
    expect(screen.getByText('Update Job')).toBeInTheDocument()
  })

  it('updates job successfully when editing', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockJob, title: 'Updated Title' }),
    })

    render(
      <JobForm
        campaignId="campaign-1"
        job={mockJob}
        organizations={mockOrganizations}
        missionTypes={mockMissionTypes}
      />
    )

    const titleInput = screen.getByLabelText(/job title/i)
    fireEvent.change(titleInput, { target: { value: 'Updated Title' } })

    const submitButton = screen.getByText('Update Job')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/jobs/job-1',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Updated Title'),
        })
      )
    })

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/gm/campaigns/campaign-1/jobs/job-1')
      expect(mockRouter.refresh).toHaveBeenCalled()
    })
  })

  it('displays error when update fails', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Update failed' }),
    })

    render(
      <JobForm
        campaignId="campaign-1"
        job={mockJob}
        organizations={mockOrganizations}
        missionTypes={mockMissionTypes}
      />
    )

    const submitButton = screen.getByText('Update Job')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/update failed/i)).toBeInTheDocument()
    })
  })

  it('creates new job successfully', async () => {
    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { ...mockJob, id: 'new-job-id' },
              error: null,
            }),
          }),
        }),
      }),
    }
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)

    render(
      <JobForm
        campaignId="campaign-1"
        organizations={mockOrganizations}
        missionTypes={mockMissionTypes}
      />
    )

    fireEvent.change(screen.getByLabelText(/job title/i), {
      target: { value: 'New Job' },
    })
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'New description' },
    })

    const submitButton = screen.getByText('Create Job')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/gm/campaigns/campaign-1/jobs/new-job-id')
      expect(mockRouter.refresh).toHaveBeenCalled()
    })
  })

  it('handles cancel button', () => {
    render(
      <JobForm
        campaignId="campaign-1"
        organizations={mockOrganizations}
        missionTypes={mockMissionTypes}
      />
    )

    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)

    expect(mockRouter.back).toHaveBeenCalled()
  })

  it('creates inline organization and mission type then job', async () => {
    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: jest.fn((table: string) => {
        if (table === 'organizations') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { id: 'org-new' }, error: null }),
              }),
            }),
          }
        }

        if (table === 'mission_types') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { id: 'mt-new' }, error: null }),
              }),
            }),
          }
        }

        if (table === 'jobs') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { id: 'job-new' }, error: null }),
              }),
            }),
          }
        }

        return { insert: jest.fn() }
      }),
    }

    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)

    render(
      <JobForm campaignId="campaign-1" organizations={mockOrganizations} missionTypes={mockMissionTypes} />
    )

    // Fill basic fields
    fireEvent.change(screen.getByLabelText(/job title/i), { target: { value: 'Inline Job' } })
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Inline description' } })

    // Select create new organization
    fireEvent.change(screen.getByLabelText(/organization/i), { target: { value: '__new__' } })
    // New org inputs should appear
    expect(screen.getByPlaceholderText(/organization name/i)).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText(/organization name/i), { target: { value: 'New Org' } })

    // Select create new mission type
    fireEvent.change(screen.getByLabelText(/mission type/i), { target: { value: '__new__' } })
    expect(screen.getByPlaceholderText(/mission type name/i)).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText(/mission type name/i), { target: { value: 'New Mission' } })

    // Submit
    const submitButton = screen.getByText('Create Job')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/gm/campaigns/campaign-1/jobs/job-new')
    })
  })
})
