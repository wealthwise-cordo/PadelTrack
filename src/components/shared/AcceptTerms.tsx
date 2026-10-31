'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { primaryButtonClass } from '@/components/shared/AuthShell'

export default function AcceptTerms({ next }: { next: string }) {
  const router = useRouter()
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const accept = async () => {
    if (!agreed) return setError('Tick the box to agree')
    setBusy(true)
    setError('')
    const res = await fetch('/api/account/terms', { method: 'POST' }).catch(() => null)
    if (!res?.ok) {
      setError('Could not save — try again')
      setBusy(false)
      return
    }
    router.replace(next)
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-black">Terms of Use</h1>
        <p className="text-sm text-zinc-600">Please read and agree to continue.</p>
      </div>
      <div className="flex gap-2">
        <Link href="/terms" className="flex-1 py-3 rounded-xl border border-zinc-200 text-center text-sm font-semibold hover:bg-zinc-50">Terms of Use</Link>
        <Link href="/privacy" className="flex-1 py-3 rounded-xl border border-zinc-200 text-center text-sm font-semibold hover:bg-zinc-50">Privacy</Link>
      </div>
      <label className="flex items-start gap-2.5 cursor-pointer text-sm text-zinc-700">
        <input type="checkbox" checked={agreed} onChange={e => { setAgreed(e.target.checked); setError('') }} className="mt-0.5 h-4 w-4 accent-orange-500 shrink-0" />
        I agree to the Terms of Use and have read the Privacy notice
      </label>
      <button onClick={accept} disabled={busy} className={`${primaryButtonClass} ${agreed ? '' : 'opacity-50'}`}>
        {busy ? 'Saving…' : 'Agree and continue'}
      </button>
      {error && <p className="text-xs text-zinc-500 text-center">{error}</p>}
    </div>
  )
}
