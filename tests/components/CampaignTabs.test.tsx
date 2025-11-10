import { render, screen, within } from '@testing-library/react'
import CampaignTabs from '@/app/gm/campaigns/[id]/CampaignTabs'

describe('CampaignTabs', () => {
  test('Members tab shows server-provided members count', () => {
    render(
      <CampaignTabs
        campaignId="camp-1"
        organizations={[]}
        missionTypes={[]}
        jobs={[]}
        userRole="owner"
        canManage={true}
        membersCount={3}
      />
    )

    const membersButton = screen.getByRole('button', { name: /Members/i })
    // within the button there's a span with the count
    const badge = within(membersButton).getByText('3')
    expect(badge).toBeInTheDocument()
  })
})
