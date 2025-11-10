export async function sendInviteEmail(email: string, token: string, campaignName?: string) {
  // If API key not configured, skip sending (useful for dev/test environments)
  if (!process.env.SENDGRID_API_KEY) {
    console.info('SENDGRID_API_KEY not set, skipping sendInviteEmail for', email)
    return null
  }

  try {
    const sg = await import('@sendgrid/mail')
    sg.default.setApiKey(process.env.SENDGRID_API_KEY!)

    // Use a path-style link which is more robust against email forwarding/tracking
    const base = process.env.NEXT_PUBLIC_APP_URL || ''
    const urlPath = `${base.replace(/\/$/, '')}/invite/${encodeURIComponent(token)}`
    const from = process.env.EMAIL_FROM || 'no-reply@localhost'
    const subject = `Invitation to join ${campaignName ?? 'a campaign'}`
    const html = `
      <p>You were invited to join <strong>${campaignName ?? 'a campaign'}</strong>.</p>
      <p>Click <a href="${urlPath}">here to accept the invitation</a>.</p>
      <p>If you don't have an account yet, signing up will automatically add you to the campaign.</p>
    `

    return sg.default.send({
      to: email,
      from,
      subject,
      html,
    })
  } catch (err) {
    console.error('sendInviteEmail error:', err)
    return null
  }
}
