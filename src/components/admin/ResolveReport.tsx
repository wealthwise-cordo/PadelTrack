'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Marking a report resolved, with an optional note of what was done.
export default function ResolveReport({ reportId }: { reportId: string }) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const resolve = async () => {
    setBusy(true)
    setError('')
    const res = await fetch(`/api/admin/reports/${reportId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resolution: note }) }).catch(() => null)
    setBusy(false)
    if (!res?.ok) return setError((await res?.json().catch(() => ({})))?.error || 'Could not save — try again')
    router.refresh()
  }

  return (
    <div className="flex gap-2">
      <input
        value={note} onChange={e => setNote(e.target.value.slice(0, 500))}
        placeholder="What you did (optional)"
        className="flex-1 min-w-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base sm:text-sm focus:outline-none focus:border-orange-500"
      />
      <button onClick={resolve} disabled={busy} className="px-3 py-2 rounded-lg text-xs font-bold bg-zinc-900 text-white disabled:opacity-50 shrink-0">{busy ? 'Saving…' : 'Resolved'}</button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
