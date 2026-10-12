// Sends email through Resend's HTTP API (https://resend.com/docs/api-reference).
// Needs RESEND_API_KEY and EMAIL_FROM (an address on a domain verified in
// Resend, e.g. "PadelTrack <no-reply@yourdomain>"). Without a key — local
// development — the email is printed to the server log instead.
export async function sendEmail(msg: { to: string; subject: string; html: string; text: string }): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.log(`\n[email] RESEND_API_KEY not set — not sent.\nTo: ${msg.to}\nSubject: ${msg.subject}\n\n${msg.text}\n`)
    return
  }
  const from = process.env.EMAIL_FROM
  if (!from) throw new Error('EMAIL_FROM is not set')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
  })
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`)
}

// Where links in emails point. Set APP_URL in production (e.g.
// https://padeltrack.co.uk) so links never depend on the request's Host header.
export function appUrl(fallbackOrigin: string): string {
  const url = process.env.APP_URL || process.env.NEXTAUTH_URL
  if (url) return url.replace(/\/$/, '')
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  return fallbackOrigin
}
