import { NextResponse, type NextRequest } from 'next/server'

// The home page (/): signed-out visitors see the welcome page. The iPhone app
// (its user agent includes PadelTrackApp, see capacitor.config.ts) skips it:
// a phone that has never been signed in (a new download) opens on sign-up,
// one that has (RETURNING_COOKIE) on sign-in. Signed-in visitors get Ranking.
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === '/' && !hasSession(req)) {
    if ((req.headers.get('user-agent') ?? '').includes('PadelTrackApp')) {
      return NextResponse.redirect(new URL(req.cookies.has(RETURNING_COOKIE) ? '/login' : '/signup', req.url))
    }
    return NextResponse.rewrite(new URL('/welcome', req.url))
  }
  return NextResponse.next()
}

// Set on this device after signing in or creating an account (rememberReturning).
const RETURNING_COOKIE = 'pt-returning'

// Signed in (or was): the Auth.js session cookie. An expired one still counts;
// the signed-in layout then sends them to sign in.
const hasSession = (req: NextRequest) => req.cookies.getAll().some(c => /^(__Secure-)?authjs\.session-token/.test(c.name))

// Only the home page.
export const config = { matcher: ['/'] }
