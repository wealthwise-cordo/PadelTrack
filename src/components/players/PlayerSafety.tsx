'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { REPORT_REASONS, type ReportReason } from '@/lib/safety-reasons'

// The quiet Report / Block links at the bottom of another player's profile,
// each opening a sheet from the bottom. Blocking only applies to players with
// an account; guests can still be reported.
export default function PlayerSafety({ playerId, name, canBlock, blocked }: { playerId: string; name: string; canBlock: boolean; blocked: boolean }) {
  const router = useRouter()
  const first = name.split(' ')[0]
  const [sheet, setSheet] = useState<'report' | 'block' | null>(null)
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reported, setReported] = useState(false)

  const close = () => { setSheet(null); setError(''); setReason(null); setDetails('') }

  const report = async () => {
    if (!reason) return setError('Pick a reason')
    setBusy(true)
    setError('')
    const res = await fetch(`/api/players/${playerId}/report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason, details }) }).catch(() => null)
    setBusy(false)
    if (!res?.ok) return setError((await res?.json().catch(() => ({})))?.error || 'Could not send — try again')
    close()
    setReported(true)
  }

  const toggleBlock = async () => {
    setBusy(true)
    setError('')
    const res = await fetch(`/api/players/${playerId}/block`, { method: blocked ? 'DELETE' : 'POST' }).catch(() => null)
    setBusy(false)
    if (!res?.ok) return setError((await res?.json().catch(() => ({})))?.error || 'Could not save — try again')
    close()
    router.refresh()
  }

  return (
    <>
      <div className="flex justify-center gap-4 pt-2 text-xs text-zinc-400">
        {reported
          ? <span>Thanks — we’ll look into it.</span>
          : <button onClick={() => setSheet('report')} className="hover:text-zinc-700">Report {first}</button>}
        {canBlock && (blocked
          ? <button onClick={toggleBlock} disabled={busy} className="hover:text-zinc-700">{busy ? 'Unblocking…' : `Unblock ${first}`}</button>
          : <button onClick={() => setSheet('block')} className="hover:text-zinc-700">Block {first}</button>)}
      </div>

      {sheet && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40" role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget && !busy) close() }}>
          <div className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-6 space-y-4 [padding-bottom:calc(1.5rem+env(safe-area-inset-bottom))]">
            {sheet === 'report' ? (
              <>
                <div className="space-y-1">
                  <h2 className="text-lg font-black">Report {first}</h2>
                  <p className="text-sm text-zinc-600">What’s wrong? Only PadelTrack sees reports.</p>
                </div>
                <div className="space-y-1.5">
                  {(Object.keys(REPORT_REASONS) as ReportReason[]).map(r => (
                    <label key={r} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm cursor-pointer ${reason === r ? 'border-orange-400 bg-orange-50' : 'border-zinc-200'}`}>
                      <input type="radio" name="reason" checked={reason === r} onChange={() => { setReason(r); setError('') }} className="accent-orange-500" />
                      {REPORT_REASONS[r]}
                    </label>
                  ))}
                </div>
                <textarea
                  value={details} onChange={e => setDetails(e.target.value.slice(0, 1000))} rows={3}
                  placeholder="Anything else we should know (optional)"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-orange-500"
                />
                <button onClick={report} disabled={busy} className="w-full py-3 rounded-xl font-bold text-sm bg-orange-500 text-white disabled:opacity-50">{busy ? 'Sending…' : 'Send report'}</button>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <h2 className="text-lg font-black">Block {first}?</h2>
                  <p className="text-sm text-zinc-600">You won’t see each other in search or your rankings, and neither of you can add the other to a match. You can unblock any time from their profile.</p>
                </div>
                <button onClick={toggleBlock} disabled={busy} className="w-full py-3 rounded-xl font-bold text-sm bg-red-600 text-white disabled:opacity-50">{busy ? 'Blocking…' : `Block ${first}`}</button>
              </>
            )}
            {error && <p className="text-xs text-red-600 text-center">{error}</p>}
            <button onClick={close} disabled={busy} className="w-full py-2 text-sm font-semibold text-zinc-500">Cancel</button>
          </div>
        </div>
      )}
      {!sheet && error && <p className="text-xs text-red-600 text-center">{error}</p>}
    </>
  )
}
