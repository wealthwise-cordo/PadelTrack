'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { ADMIN_UNLOCK_EVENT, type UnlockRequest } from '@/lib/admin-fetch'

// Asks the super user for their admin password when a protected action needs
// it (or, the first time, to set one). Mounted once for super users.
export default function AdminUnlockDialog() {
  const [req, setReq] = useState<UnlockRequest | null>(null)
  const [password, setPassword] = useState('')
  const [accountPassword, setAccountPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const open = (e: Event) => {
      setReq((e as CustomEvent<UnlockRequest>).detail)
      setPassword(''); setAccountPassword(''); setConfirm(''); setError('')
    }
    window.addEventListener(ADMIN_UNLOCK_EVENT, open)
    return () => window.removeEventListener(ADMIN_UNLOCK_EVENT, open)
  }, [])

  if (!req) return null
  const close = (unlocked: boolean) => { req.resolve(unlocked); setReq(null) }
  const post = (url: string, body: object) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (req.needsSetup) {
        if (password !== confirm) return setError('The admin passwords don’t match')
        const set = await post('/api/admin/password', { accountPassword, newPassword: password })
        if (!set.ok) return setError((await set.json().catch(() => ({}))).error || 'Could not save')
      }
      const res = await post('/api/admin/unlock', { password })
      if (!res.ok) return setError((await res.json().catch(() => ({}))).error || 'Incorrect admin password')
      close(true)
    } finally {
      setBusy(false)
    }
  }

  const input = 'w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-base focus:outline-none focus:border-orange-500'
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40" role="dialog" aria-modal="true" aria-labelledby="admin-unlock-title">
      <form onSubmit={submit} className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-6 space-y-4 [padding-bottom:calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-orange-500" />
          <h2 id="admin-unlock-title" className="text-lg font-black">{req.needsSetup ? 'Set an admin password' : 'Admin password'}</h2>
        </div>
        <p className="text-sm text-zinc-600">
          {req.needsSetup
            ? 'Asked before changing ratings, matches or accounts. Use a different password from your sign-in.'
            : 'Unlocks admin actions on this device for 15 minutes.'}
        </p>
        {req.needsSetup && (
          <input type="password" autoComplete="current-password" placeholder="Your account password" value={accountPassword} onChange={e => setAccountPassword(e.target.value)} className={input} />
        )}
        <input type="password" autoComplete={req.needsSetup ? 'new-password' : 'off'} autoFocus placeholder={req.needsSetup ? 'New admin password (8+ characters)' : 'Admin password'} value={password} onChange={e => setPassword(e.target.value)} className={input} />
        {req.needsSetup && (
          <input type="password" autoComplete="new-password" placeholder="Admin password again" value={confirm} onChange={e => setConfirm(e.target.value)} className={input} />
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button type="submit" disabled={busy || !password} className="w-full py-3 rounded-xl font-bold text-sm bg-orange-500 text-white disabled:opacity-50">
          {busy ? 'Checking…' : req.needsSetup ? 'Save and continue' : 'Unlock'}
        </button>
        <button type="button" onClick={() => close(false)} disabled={busy} className="w-full py-2 text-sm font-semibold text-zinc-500">Cancel</button>
      </form>
    </div>
  )
}
