'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Ban } from 'lucide-react'
import type { ScoreReport } from '@/types'

const MIN_REASON = 10

// The super user's controls under one unconfirmed match: a reason (required),
// then confirm, pick a disputed score, or void.
export default function AdminMatchActions({ matchId, status, disputed, reports }: {
  matchId: string
  status: 'scheduled' | 'pending' | 'complete'
  disputed: boolean
  reports: ScoreReport[]
}) {
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ok = reason.trim().length >= MIN_REASON && !busy

  async function act(action: 'confirm' | 'settle' | 'void', reportId?: string) {
    if (!ok) return
    if (action === 'void' && !confirm('Void this match? It’s removed for everyone in it.')) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/matches/${matchId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: reason.trim(), reportId }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) setError(d.error || 'Something went wrong')
      else router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const open = reports.filter(r => r.status === 'open')
  const btn = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed'
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 space-y-2">
      <textarea
        rows={2} maxLength={500} value={reason} onChange={e => setReason(e.target.value)}
        placeholder="Reason (required) — the players will see it"
        className="w-full bg-zinc-900/5 border border-zinc-900/10 rounded-lg px-3 py-2 text-base sm:text-sm focus:outline-none focus:border-orange-500 resize-none"
      />
      {disputed && open.length > 0 && (
        <div className="space-y-1.5">
          {open.map(r => (
            <div key={r.id} className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm font-bold">{r.sets.map(x => `${x.teamAGames}-${x.teamBGames}`).join('  ')}{r.incomplete && <span className="ml-1.5 text-[10px] font-sans text-zinc-500">didn’t finish</span>}</div>
                <div className="text-[11px] text-zinc-500">Entered by {r.submittedBy}</div>
              </div>
              <button onClick={() => act('settle', r.id)} disabled={!ok} className={`${btn} bg-orange-500 text-white hover:bg-orange-600 shrink-0`}>
                <Check className="h-3.5 w-3.5" /> Pick this score
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[11px] text-zinc-400">{reason.trim().length < MIN_REASON ? `Reason: at least ${MIN_REASON} characters` : ''}</span>
        <button onClick={() => act('void')} disabled={!ok} className={`${btn} bg-zinc-100 text-zinc-800 hover:bg-red-50 hover:text-red-700`}>
          <Ban className="h-3.5 w-3.5" /> Void
        </button>
        {status === 'pending' && !disputed && (
          <button onClick={() => act('confirm')} disabled={!ok} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}>
            <Check className="h-3.5 w-3.5" /> Confirm
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
