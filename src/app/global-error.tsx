'use client'

import { useEffect } from 'react'
import { reportError } from '@/lib/report-error'

// Last resort when the root layout itself crashes; replaces the whole page.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportError(error), [error])
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 12, margin: 0, padding: 16, textAlign: 'center' }}>
        <p style={{ fontWeight: 700 }}>Something went wrong</p>
        <p style={{ fontSize: 14, color: '#71717a' }}>We’ve logged the problem.</p>
        <button onClick={reset} style={{ padding: '8px 16px', borderRadius: 12, border: 0, background: '#f97316', color: '#fff', fontWeight: 700 }}>Try again</button>
      </body>
    </html>
  )
}
