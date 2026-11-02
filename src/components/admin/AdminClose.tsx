'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { pageBefore } from '@/components/shared/TabSwipe'
import { announceLockState } from '@/lib/admin-fetch'

// Admin's way out (it has no back swipe): locks admin actions on this device
// again and returns to wherever you were before opening Admin.
export default function AdminClose() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const close = async () => {
    setBusy(true)
    await fetch('/api/admin/unlock', { method: 'DELETE' }).catch(() => {})
    announceLockState(null)
    router.push(pageBefore('/admin'))
  }
  return (
    <button
      onClick={close}
      disabled={busy}
      aria-label="Close and lock Admin"
      className="h-9 w-9 shrink-0 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center hover:bg-zinc-200 disabled:opacity-50"
    >
      <X className="h-5 w-5" />
    </button>
  )
}
