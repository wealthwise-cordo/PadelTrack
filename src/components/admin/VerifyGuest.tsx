'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BadgeCheck } from 'lucide-react'
import { LTA_LEVELS } from '@/lib/lta'

// Pick a level for a guest and make them a ranked guest.
export default function VerifyGuest({ playerId, name, suggestedLevel }: { playerId: string; name: string; suggestedLevel: number | null }) {
  const router = useRouter()
  const [level, setLevel] = useState(suggestedLevel !== null ? String(suggestedLevel) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function verify() {
    if (!level || busy) return
    if (!confirm(`Verify ${name} at level ${Number(level).toFixed(1)}? Their ranked matches will count without them joining.`)) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/guests/${playerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: Number(level) }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) setError(d.error || 'Something went wrong')
      else router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <select
          value={level} onChange={e => setLevel(e.target.value)} aria-label={`Level for ${name}`}
          className="flex-1 min-w-0 bg-zinc-900/5 border border-zinc-900/10 rounded-lg px-3 py-2 text-base sm:text-sm focus:outline-none focus:border-orange-500"
        >
          <option value="">Pick a level…</option>
          {LTA_LEVELS.map(l => (
            <option key={l.level} value={l.level}>{l.level.toFixed(1)}{l.level === suggestedLevel ? ' (suggested)' : ''}</option>
          ))}
        </select>
        <button
          onClick={verify} disabled={!level || busy}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <BadgeCheck className="h-3.5 w-3.5" /> {busy ? 'Verifying…' : 'Verify'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
