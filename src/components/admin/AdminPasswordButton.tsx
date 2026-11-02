'use client'

import { useState } from 'react'
import { ADMIN_UNLOCK_EVENT, type UnlockRequest } from '@/lib/admin-fetch'

// In Admin: set or change the admin password, and lock admin actions again
// on this device before the 15 minutes are up.
export default function AdminPasswordButton({ hasPassword }: { hasPassword: boolean }) {
  const [locked, setLocked] = useState(false)
  const change = () => window.dispatchEvent(new CustomEvent<UnlockRequest>(ADMIN_UNLOCK_EVENT, { detail: { needsSetup: true, resolve: () => {} } }))
  const lock = async () => {
    await fetch('/api/admin/unlock', { method: 'DELETE' }).catch(() => {})
    setLocked(true)
    setTimeout(() => setLocked(false), 2000)
  }
  return (
    <div className="flex gap-3 text-[11px] text-zinc-400">
      <button onClick={change} className="hover:text-zinc-700">{hasPassword ? 'Change admin password' : 'Set admin password'}</button>
      {hasPassword && <button onClick={lock} className="hover:text-zinc-700">{locked ? 'Locked' : 'Lock admin'}</button>}
    </div>
  )
}
