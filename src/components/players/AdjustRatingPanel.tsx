'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SlidersHorizontal, X, Clock } from 'lucide-react'
import { levelFromInternal, MAX_LEVEL, MIN_LEVEL } from '@/lib/lta'

const MAX_ADJUST = 1
const MIN_REASON = 10
const MAX_REASON = 500

interface Props {
  playerId: string
  firstName: string
  // Internal rating points.
  ptr: number
  isSuperUser: boolean
  // Set when an adjustment was approved or rejected in the last 30 days: no
  // new adjustment until then.
  coolingOffUntil: string | null
  // An adjustment already waiting for review on this player.
  pending: { levels: number; reason: string; requestedBy: string | null } | null
}

const inputClass = 'bg-zinc-900/5 border border-zinc-900/10 rounded-lg px-3 py-2 text-base sm:text-sm focus:outline-none focus:border-orange-500'
const fieldClass = `w-full ${inputClass}`
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toFixed(2)}`

// For levellers and the super user on someone else's profile: move their
// rating by up to one level, with a reason. A leveller's change goes to the
// super user for review; the super user's applies at once.
export default function AdjustRatingPanel({ playerId, firstName, ptr, isSuperUser, coolingOffUntil, pending }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [levels, setLevels] = useState(0)
  // What's typed in the exact box, so "-" or "0." can be typed on the way.
  const [typed, setTyped] = useState('0')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const current = levelFromInternal(ptr)
  // Never outside 1.0–7.0.
  const minAdj = Math.max(-MAX_ADJUST, Math.ceil((MIN_LEVEL - current) * 100) / 100)
  const maxAdj = Math.min(MAX_ADJUST, Math.floor((MAX_LEVEL - current) * 100) / 100)
  const reasonOk = reason.trim().length >= MIN_REASON
  const canSubmit = levels !== 0 && reasonOk && !saving

  function setClamped(v: number) {
    if (!Number.isFinite(v)) return
    const next = Math.round(Math.min(maxAdj, Math.max(minAdj, v)) * 100) / 100
    setLevels(next)
    return next
  }

  function close() {
    setOpen(false)
    setLevels(0)
    setTyped('0')
    setReason('')
    setError('')
  }

  async function submit() {
    if (!canSubmit) return
    if (isSuperUser && !confirm(`Change ${firstName}’s rating from ${current.toFixed(2)} to ${(current + levels).toFixed(2)}? This applies straight away.`)) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/players/${playerId}/adjustments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ levels, reason: reason.trim() }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d.error || 'Adjustment failed')
      } else {
        setDone(d.status === 'pending' ? 'Sent to the super user for review.' : 'Rating adjusted.')
        close()
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  if (pending) {
    return (
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900 flex gap-2">
        <Clock className="h-4 w-4 shrink-0 mt-px" />
        <div>
          <span className="font-semibold">Adjustment of {signed(pending.levels)} waiting for review</span>
          {pending.requestedBy && <> · from {pending.requestedBy}</>}
          <div className="text-amber-800 mt-0.5">{pending.reason}</div>
        </div>
      </div>
    )
  }

  if (coolingOffUntil) {
    const until = new Date(coolingOffUntil).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' })
    return (
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span>Adjustment reviewed in the last 30 days · next one possible from {until}</span>
      </div>
    )
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button onClick={() => { setDone(''); setOpen(true) }} className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Adjust rating
        </button>
        {done && <span className="text-xs text-emerald-700">{done}</span>}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5"><SlidersHorizontal className="h-4 w-4 text-orange-500" /> Adjust {firstName}’s rating</h3>
        <button onClick={close} className="text-zinc-400 hover:text-zinc-700" aria-label="Cancel"><X className="h-4 w-4" /></button>
      </div>

      <div>
        <div className="flex items-baseline justify-between text-sm mb-1">
          <span className="text-zinc-500">Up to one level either way</span>
          <span className="font-mono font-semibold">
            {current.toFixed(2)} → <span className={levels > 0 ? 'text-emerald-700' : levels < 0 ? 'text-red-600' : ''}>{(current + levels).toFixed(2)}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range" min={minAdj} max={maxAdj} step={0.05} value={levels}
            onChange={e => setTyped(String(setClamped(Number(e.target.value))))}
            className="flex-1 accent-orange-500" aria-label="Adjustment in levels"
          />
          <input
            type="text" inputMode="decimal" value={typed}
            onChange={e => {
              setTyped(e.target.value)
              const v = Number(e.target.value)
              if (e.target.value.trim() !== '' && Number.isFinite(v)) setClamped(v)
            }}
            onBlur={() => setTyped(String(levels))}
            className={`${inputClass} w-24 shrink-0 font-mono text-right`} aria-label="Adjustment in levels, exact"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-zinc-600" htmlFor="adjust-reason">Reason (required)</label>
        <textarea
          id="adjust-reason" rows={3} maxLength={MAX_REASON} value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Why this rating doesn’t reflect how they play — e.g. results in matches outside PadelTrack"
          className={`${fieldClass} mt-1 resize-none`}
        />
        <div className="text-[11px] text-zinc-400 text-right">{reason.trim().length < MIN_REASON ? `At least ${MIN_REASON} characters` : `${reason.length}/${MAX_REASON}`}</div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-zinc-500">{isSuperUser ? 'Applies straight away.' : 'Goes to the super user for approval before it applies.'}</p>
        <button
          onClick={submit} disabled={!canSubmit}
          className="px-3 py-2 rounded-lg text-sm font-bold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {saving ? 'Saving…' : isSuperUser ? 'Apply' : 'Send for review'}
        </button>
      </div>
    </div>
  )
}
