import { NextResponse } from 'next/server'

// Tells iPhones that www.padeltrack.co.uk links (a join link, an invite, a
// match) open in the PadelTrack app when it's installed, and that the app may
// offer (and save) the site's passwords from the Passwords app. Needs APPLE_TEAM_ID
// (the developer account's Team ID); the app ID is <team>.<bundle id>.
export const dynamic = 'force-static'

export function GET() {
  const team = process.env.APPLE_TEAM_ID
  const bundle = process.env.APNS_BUNDLE_ID || 'uk.co.padeltrack.app'
  const appID = team ? `${team}.${bundle}` : null
  return NextResponse.json({
    applinks: { details: appID ? [{ appIDs: [appID], components: [{ '/': '/api/*', exclude: true }, { '/': '/*' }] }] : [] },
    webcredentials: { apps: appID ? [appID] : [] },
  })
}
