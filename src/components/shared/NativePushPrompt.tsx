'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { enableNativePush, markAskedForPush, shouldAskForPush } from '@/lib/native'

// In the iPhone app only: the first time someone signed in opens it, a short
// screen offering notifications. "Turn on" shows iOS's own pop-up (which the
// app only gets once); "Not now" keeps that for later — the card in Match
// Centre and the menu toggle still offer it.
export default function NativePushPrompt() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void shouldAskForPush().then(setOpen).catch(() => {})
  }, [])

  if (!open) return null
  const close = () => {
    markAskedForPush()
    setOpen(false)
  }
  const turnOn = async () => {
    setBusy(true)
    await enableNativePush().catch(() => {})
    close()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40" role="dialog" aria-modal="true" aria-labelledby="push-prompt-title">
      <div className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-6 space-y-4 [padding-bottom:calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="h-12 w-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center">
          <Bell className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 id="push-prompt-title" className="text-lg font-black">Turn on notifications</h2>
          <p className="text-sm text-zinc-600">Know when a match needs confirming, someone joins your match, or a result is in.</p>
        </div>
        <div className="space-y-2">
          <button onClick={turnOn} disabled={busy} className="w-full py-3 rounded-xl font-bold text-sm bg-orange-500 text-white disabled:opacity-50">
            {busy ? 'Turning on…' : 'Turn on notifications'}
          </button>
          <button onClick={close} disabled={busy} className="w-full py-3 rounded-xl text-sm font-semibold text-zinc-500">Not now</button>
        </div>
      </div>
    </div>
  )
}
