'use client'

import { useEffect } from 'react'
import { reportError } from '@/lib/report-error'

// Shown when a page crashes; the error is logged for the admin page.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportError(error), [error])
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-bold">Something went wrong</p>
      <p className="text-sm text-zinc-500">We’ve logged the problem. Try again, or go back to your rankings.</p>
      <div className="flex gap-2 mt-2">
        <button onClick={reset} className="px-4 py-2 rounded-xl text-sm font-bold bg-orange-500 text-white">Try again</button>
        <a href="/" className="px-4 py-2 rounded-xl text-sm font-semibold border border-zinc-300">Rankings</a>
      </div>
    </div>
  )
}
