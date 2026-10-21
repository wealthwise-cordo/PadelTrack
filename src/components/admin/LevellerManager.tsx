'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, X } from 'lucide-react'

// The super user's list of levellers: add by account email, or remove.
export default function LevellerManager({ levellers }: { levellers: { id: string; name: string; email: string }[] }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function call(method: 'POST' | 'DELETE', body: object) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/levellers', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) setError(d.error || 'Something went wrong')
      else {
        setEmail('')
        router.refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {levellers.length === 0 ? (
        <p className="text-sm text-zinc-500">No levellers yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {levellers.map(l => (
            <li key={l.id} className="flex items-center gap-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{l.name}</div>
                <div className="text-[11px] text-zinc-500 truncate">{l.email}</div>
              </div>
              <button
                onClick={() => confirm(`Remove ${l.name} as a leveller?`) && call('DELETE', { userId: l.id })}
                disabled={busy} className="text-xs font-semibold text-zinc-500 hover:text-red-600 inline-flex items-center gap-1"
              >
                <X className="h-3.5 w-3.5" /> Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={e => { e.preventDefault(); if (email.trim()) call('POST', { email: email.trim() }) }} className="flex gap-2">
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Their PadelTrack email"
          className="flex-1 min-w-0 bg-zinc-900/5 border border-zinc-900/10 rounded-lg px-3 py-2 text-base sm:text-sm focus:outline-none focus:border-orange-500"
        />
        <button disabled={busy || !email.trim()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-40 shrink-0">
          <UserPlus className="h-4 w-4" /> Add
        </button>
      </form>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
