'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch } from '@/lib/admin-fetch'

// In Admin → Users, for the super user: suspend (can't sign in until
// unsuspended) or delete an account, with a reason kept in the log. Both
// ask for the admin password.
export default function AccountActions({ playerId, name, suspended }: { playerId: string; name: string; suspended: boolean }) {
  const router = useRouter()
  const first = name.split(' ')[0]
  const [action, setAction] = useState<'suspend' | 'delete' | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async (what: 'suspend' | 'unsuspend' | 'delete') => {
    setBusy(true)
    setError('')
    const res = await adminFetch(`/api/admin/users/${playerId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: what, reason }) })
    setBusy(false)
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error || 'Something went wrong')
    setAction(null)
    setReason('')
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-3 space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Admin · account</span>
        {suspended && <span className="text-[10px] font-semibold text-red-700 bg-red-100 rounded px-1.5 py-0.5">SUSPENDED</span>}
      </div>
      {action ? (
        <div className="space-y-2">
          <p className="text-xs text-zinc-600">
            {action === 'suspend'
              ? `${first} won't be able to sign in until you unsuspend them. Their matches and rating stay as they are.`
              : `${first}'s account is deleted: their email, password and details are erased and their profile can no longer be opened. Their name stays on confirmed matches. This can't be undone.`}
          </p>
          <input value={reason} onChange={e => setReason(e.target.value.slice(0, 300))} placeholder="Reason (kept in the Admin log)" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-base sm:text-sm focus:outline-none focus:border-orange-500" />
          <div className="flex gap-2">
            <button onClick={() => run(action)} disabled={busy || reason.trim().length < 5} className="px-3 py-2 rounded-lg text-xs font-bold bg-red-600 text-white disabled:opacity-40">
              {busy ? 'Working…' : action === 'suspend' ? `Suspend ${first}` : `Delete ${first}'s account`}
            </button>
            <button onClick={() => { setAction(null); setError('') }} disabled={busy} className="px-3 py-2 rounded-lg text-xs font-semibold text-zinc-500">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          {suspended
            ? <button onClick={() => run('unsuspend')} disabled={busy} className="px-3 py-2 rounded-lg text-xs font-semibold border border-zinc-300">{busy ? 'Working…' : 'Unsuspend'}</button>
            : <button onClick={() => setAction('suspend')} className="px-3 py-2 rounded-lg text-xs font-semibold border border-zinc-300">Suspend</button>}
          <button onClick={() => setAction('delete')} className="px-3 py-2 rounded-lg text-xs font-semibold border border-red-200 text-red-700">Delete account</button>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
