'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { LEGAL } from '@/lib/legal'
import { forgetThisDevice } from '@/lib/native'

// Slides up over the page for anyone signed in who hasn't agreed to the
// current Terms of Use and Privacy notice (LEGAL_VERSION): a new account, or
// documents updated since they last agreed. It can't be dismissed, only
// declined by signing out. Once
// agreed, the layout re-renders without it (and the app offers notifications).
export default function TermsSheet() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const agree = async () => {
    setBusy(true)
    setError('')
    const res = await fetch('/api/account/terms', { method: 'POST' }).catch(() => null)
    if (!res?.ok) {
      setError('Could not save — try again')
      setBusy(false)
      return
    }
    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40" role="dialog" aria-modal="true" aria-labelledby="terms-sheet-title">
      <div className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-6 space-y-4 [padding-bottom:calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="space-y-1">
          <h2 id="terms-sheet-title" className="text-lg font-black">Before you continue</h2>
          <p className="text-sm text-zinc-600">Please agree to PadelTrack’s Terms of Use and read the Privacy notice.</p>
        </div>
        <button onClick={agree} disabled={busy} className="w-full py-3 rounded-xl font-bold text-sm bg-orange-500 text-white disabled:opacity-50">
          {busy ? 'Saving…' : 'Agree and continue'}
        </button>
        {error && <p className="text-xs text-zinc-500 text-center">{error}</p>}
        <p className="flex justify-center gap-4 text-[11px] text-zinc-400">
          <a href={LEGAL.termsUrl} className="hover:text-zinc-700">Terms of Use</a>
          <a href={LEGAL.privacyUrl} className="hover:text-zinc-700">Privacy</a>
          <button onClick={async () => { await forgetThisDevice(); await signOut({ callbackUrl: '/login' }) }} disabled={busy} className="hover:text-zinc-700">Sign out</button>
        </p>
      </div>
    </div>
  )
}
