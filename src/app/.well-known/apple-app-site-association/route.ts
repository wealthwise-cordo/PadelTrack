import { NextResponse } from 'next/server'

// Tells iPhones that www.padeltrack.co.uk links (a join link, an invite, a
// match) open in the PadelTrack app when it's installed. Needs APPLE_TEAM_ID
// (the developer account's Team ID); the app ID is <team>.<bundle id>.
export const dynamic = 'force-static'

export function GET() {
  const team = process.env.APPLE_TEAM_ID
  const bundle = process.env.APNS_BUNDLE_ID || 'uk.co.padeltrack.app'
  const details = team
    ? [{ appIDs: [`${team}.${bundle}`], components: [{ '/': '/api/*', exclude: true }, { '/': '/*' }] }]
    : []
  return NextResponse.json({ applinks: { details } })
}
