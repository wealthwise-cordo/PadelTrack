'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch } from '@/lib/admin-fetch'

// Under a guest in Admin → Users: delete them, with a reason for the log
// (admin password needed).
export default function DeleteGuest({ playerId, name }: { playerId: string; name: string }) {
  const router = useRouter()
  const first = name.split(' ')[0]
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const remove = async () => {
    setBusy(true)
    setError('')
    const res = await adminFetch(`/api/admin/guests/${playerId}/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) })
    setBusy(false)
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error || 'Something went wrong')
    router.refresh()
  }

  if (!open) return <button onClick={() => setOpen(true)} className="text-[11px] font-semibold text-zinc-400 hover:text-red-600 shrink-0">Delete</button>
  return (
    <div className="basis-full mt-2 rounded-xl border border-red-200 bg-red-50/40 p-3 space-y-2">
      <p className="text-xs text-zinc-600">
        {first} is removed: they can’t be picked or opened and their invite link stops working. Their name stays on confirmed matches, so nobody’s results or ratings change. Unconfirmed matches with them are removed. This can’t be undone.
      </p>
      <input
        value={reason} onChange={e => setReason(e.target.value.slice(0, 300))} placeholder="Reason (kept in the log)"
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base sm:text-sm focus:outline-none focus:border-orange-500"
      />
      <div className="flex gap-2">
        <button onClick={remove} disabled={busy || reason.trim().length < 5} className="px-3 py-2 rounded-lg text-xs font-bold bg-red-600 text-white disabled:opacity-40">{busy ? 'Deleting…' : `Delete ${first}`}</button>
        <button onClick={() => { setOpen(false); setError('') }} disabled={busy} className="px-3 py-2 rounded-lg text-xs font-semibold text-zinc-500">Cancel</button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
