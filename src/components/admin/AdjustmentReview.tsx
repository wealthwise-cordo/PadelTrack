'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'

// Approve / reject buttons for one pending adjustment, with an optional note.
export default function AdjustmentReview({ id }: { id: string }) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState('')

  async function act(action: 'approve' | 'reject') {
    setBusy(action)
    setError('')
    try {
      const res = await fetch(`/api/adjustments/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: note.trim() }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) setError(d.error || 'Review failed')
      else router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-2">
      <input
        value={note} onChange={e => setNote(e.target.value)} maxLength={500} placeholder="Note (optional)"
        className="w-full bg-zinc-900/5 border border-zinc-900/10 rounded-lg px-3 py-2 text-base sm:text-sm focus:outline-none focus:border-orange-500"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => act('approve')} disabled={!!busy} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40">
          <Check className="h-4 w-4" /> {busy === 'approve' ? 'Approving…' : 'Approve'}
        </button>
        <button onClick={() => act('reject')} disabled={!!busy} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold bg-zinc-100 text-zinc-800 hover:bg-zinc-200 disabled:opacity-40">
          <X className="h-4 w-4" /> {busy === 'reject' ? 'Rejecting…' : 'Reject'}
        </button>
      </div>
    </div>
  )
}
