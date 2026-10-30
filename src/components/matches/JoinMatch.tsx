'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getInitials } from '@/lib/utils'
import { primaryButtonClass } from '@/components/shared/AuthShell'

type Seat = { id: string; name: string; avatarColor: string } | null

// The two pairs of a match from a join link. Tapping an open spot takes it,
// next to whoever's in that pair. `preview` (signed out) only shows them.
export default function JoinMatch({ token, seats, isIn, preview }: { token: string; seats: Seat[]; isIn: boolean; preview?: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState('')

  const join = async (seat: number) => {
    setBusy(seat)
    setError('')
    const res = await fetch(`/api/join/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seat }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(d.error || 'Could not join')
      setBusy(null)
      router.refresh()
      return
    }
    router.push('/matches')
    router.refresh()
  }

  const full = seats.every(Boolean)
  const spot = (i: number) => {
    const p = seats[i]
    if (p) {
      return (
        <div key={i} className="h-14 flex items-center gap-2 px-2 rounded-xl bg-white border border-zinc-200 min-w-0">
          <span className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: p.avatarColor }}>{getInitials(p.name)}</span>
          <span className="text-sm font-semibold truncate">{p.name.split(' ')[0]}</span>
        </div>
      )
    }
    if (preview || isIn) {
      return <div key={i} className="h-14 rounded-xl border-2 border-dashed border-zinc-200 flex items-center justify-center text-xs font-semibold text-zinc-400">Open</div>
    }
    return (
      <button
        key={i}
        onClick={() => join(i)}
        disabled={busy !== null}
        className="h-14 rounded-xl border-2 border-dashed border-orange-400 bg-orange-50 text-xs font-bold text-orange-600 active:scale-[0.98] transition disabled:opacity-50"
      >
        {busy === i ? 'Joining…' : 'Join here'}
      </button>
    )
  }

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-3 grid grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)] items-center gap-x-1.5">
        <div className="space-y-2">{spot(0)}{spot(1)}</div>
        <span className="text-center text-[9px] font-black text-zinc-300">VS</span>
        <div className="space-y-2">{spot(2)}{spot(3)}</div>
      </div>
      {!preview && (isIn || full) && (
        <>
          <p className="text-sm text-zinc-600 text-center">{isIn ? 'You’re in this match' : 'This match is full'}</p>
          <Link href="/matches" className={`${primaryButtonClass} block text-center`}>Match Centre</Link>
        </>
      )}
      {!preview && !isIn && !full && <p className="text-[11px] text-zinc-400 text-center">Tap a spot to join that pair</p>}
      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
    </div>
  )
}
