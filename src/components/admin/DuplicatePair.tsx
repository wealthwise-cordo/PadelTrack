'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Merge, X } from 'lucide-react'
import { formatRating } from '@/lib/utils'

type Side = {
  id: string
  name: string
  kind: string
  rated: boolean
  ptr: number
  addedBy: string | null
  createdAt: string
  matches: number
  rankedMatches: number
}

// Two players whose names are at least 90% alike: keep one and merge the
// other into it, or mark them as different people.
export default function DuplicatePair({ similarity, a, b, keepA, keepB }: {
  similarity: number
  a: Side
  b: Side
  // Why that side can't be kept, or null if it can.
  keepA: string | null
  keepB: string | null
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function post(body: object, question: string) {
    if (busy || !confirm(question)) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/duplicates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) setError(d.error || 'Something went wrong')
      else router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const merge = (keep: Side, remove: Side) =>
    post({ action: 'merge', keepId: keep.id, removeId: remove.id },
      `Merge ${remove.name} into ${keep.name}? ${remove.name}’s matches move across and their invite link stops working. This can’t be undone.`)

  const card = (p: Side, blocked: string | null, other: Side) => (
    <div className="flex-1 min-w-0 rounded-lg bg-zinc-50 p-3 space-y-2">
      <div>
        <a href={`/players/${p.id}`} className="font-semibold hover:underline break-words">{p.name}</a>
        <div className="text-[11px] text-zinc-500">
          {p.kind}{p.addedBy && <> · added by {p.addedBy}</>}
        </div>
        <div className="text-[11px] text-zinc-500">
          {p.matches} {p.matches === 1 ? 'match' : 'matches'} · {p.rankedMatches} ranked{p.rated && <> · {formatRating(p.ptr)}</>}
        </div>
      </div>
      {blocked ? (
        <p className="text-[11px] text-zinc-400">Can’t keep: {blocked}</p>
      ) : (
        <button onClick={() => merge(p, other)} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-40">
          <Merge className="h-3.5 w-3.5" /> Keep this one
        </button>
      )}
    </div>
  )

  return (
    <div className="glass rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-orange-700">{Math.round(similarity * 100)}% name match</span>
        <button
          onClick={() => post({ action: 'dismiss', aId: a.id, bId: b.id }, `Mark ${a.name} and ${b.name} as different people? They won’t be suggested again.`)}
          disabled={busy} className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-900 disabled:opacity-40"
        >
          <X className="h-3.5 w-3.5" /> Not the same
        </button>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        {card(a, keepA, b)}
        {card(b, keepB, a)}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
