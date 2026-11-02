'use client'

import { useEffect, useState } from 'react'
import { Lock, LockOpen } from 'lucide-react'
import { ADMIN_LOCK_STATE_EVENT, ADMIN_UNLOCK_EVENT, announceLockState, type UnlockRequest } from '@/lib/admin-fetch'

// The small padlock beside Admin's ✕: open while admin actions are unlocked
// on this device (the 15 minutes after entering the admin password), closed
// otherwise. Tapping it asks for the password, or locks again.
export default function AdminLock({ initialUntil, hasPassword }: { initialUntil: number | null; hasPassword: boolean }) {
  const [until, setUntil] = useState(initialUntil)

  useEffect(() => {
    const on = (e: Event) => setUntil((e as CustomEvent<number | null>).detail)
    window.addEventListener(ADMIN_LOCK_STATE_EVENT, on)
    return () => window.removeEventListener(ADMIN_LOCK_STATE_EVENT, on)
  }, [])

  // Closes itself when the 15 minutes run out.
  useEffect(() => {
    if (!until) return
    const t = setTimeout(() => setUntil(null), Math.max(0, until - Date.now()))
    return () => clearTimeout(t)
  }, [until])

  const unlocked = !!until && until > Date.now()
  const toggle = async () => {
    if (unlocked) {
      await fetch('/api/admin/unlock', { method: 'DELETE' }).catch(() => {})
      announceLockState(null)
    } else {
      window.dispatchEvent(new CustomEvent<UnlockRequest>(ADMIN_UNLOCK_EVENT, { detail: { needsSetup: !hasPassword, resolve: () => {} } }))
    }
  }

  const Icon = unlocked ? LockOpen : Lock
  return (
    <button
      onClick={toggle}
      aria-label={unlocked ? 'Admin unlocked — tap to lock' : 'Admin locked — tap to unlock'}
      className={`h-9 w-9 shrink-0 flex items-center justify-center ${unlocked ? 'text-orange-500' : 'text-zinc-400'} hover:text-zinc-700`}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}
