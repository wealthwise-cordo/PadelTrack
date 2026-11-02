'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch } from '@/lib/admin-fetch'

// Under a confirmed match in Admin → Matches: remove it, with a reason for the
// log (admin password needed). For a ranked match the four players lose just
// this match's rating change and its stats; nobody is notified.
export default function RemoveMatch({ matchId, ranked, incomplete }: { matchId: string; ranked: boolean; incomplete: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const remove = async () => {
    setBusy(true)
    setError('')
    const res = await adminFetch(`/api/admin/matches/${matchId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'remove', reason }) })
    setBusy(false)
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error || 'Something went wrong')
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return <button onClick={() => setOpen(true)} className="text-[11px] font-semibold text-zinc-400 hover:text-red-600">Remove match</button>
  }
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/40 p-3 space-y-2">
      <p className="text-xs text-zinc-600">
        {ranked && !incomplete
          ? 'The four players lose the rating change from this match (their later results stay as they are) and it comes off their stats. They aren’t notified. This can’t be undone.'
          : ranked
            ? 'It comes off the four players’ stats (matches played, sets and games). They aren’t notified. This can’t be undone.'
            : 'The friendly is deleted from everyone’s matches. They aren’t notified. This can’t be undone.'}
      </p>
      <input
        value={reason} onChange={e => setReason(e.target.value.slice(0, 500))} placeholder="Reason (at least 10 characters, kept in the log)"
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base sm:text-sm focus:outline-none focus:border-orange-500"
      />
      <div className="flex gap-2">
        <button onClick={remove} disabled={busy || reason.trim().length < 10} className="px-3 py-2 rounded-lg text-xs font-bold bg-red-600 text-white disabled:opacity-40">{busy ? 'Removing…' : 'Remove match'}</button>
        <button onClick={() => { setOpen(false); setError('') }} disabled={busy} className="px-3 py-2 rounded-lg text-xs font-semibold text-zinc-500">Cancel</button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
