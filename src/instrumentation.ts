// Runs once when a server instance starts. Next.js reports unhandled errors
// in pages and API routes through console.error, so errors are copied from
// there into ErrorLog for the admin page (Vercel's own logs are short-lived).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { logError } = await import('@/lib/analytics')
  const original = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    original(...args)
    // Only real Error objects — skips React's dev warnings — and never the
    // analytics module's own failures, which would loop.
    const error = args.find((a): a is Error => a instanceof Error)
    if (!error || (typeof args[0] === 'string' && /^(logError|recordSignIn|recordActiveDay)$/.test(args[0]))) return
    void logError({ source: 'server', error })
  }
}
