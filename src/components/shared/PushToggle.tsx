'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, Share } from 'lucide-react'

// Phone notifications on/off for this device. iPhones only allow them for
// PadelTrack added to the Home Screen, so there it explains that first.
// `card`: a prompt in Match Centre (hidden once on or dismissed);
// `menu`: a row in the account menu;
// `inline`: part of onboarding (after sign-up, in "Complete your profile"),
// with no dismiss — the surrounding step has its own way on.

type State = 'loading' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on'

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
const DISMISS_KEY = 'pt-push-card-dismissed'

function keyBytes(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

function isIosBrowserTab() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches
  return ios && !standalone
}

// `onUnavailable`: called if this device can't do notifications at all, so an
// onboarding step can skip itself.
export default function PushToggle({ variant, onUnavailable }: { variant: 'card' | 'menu' | 'inline'; onUnavailable?: () => void }) {
  const [state, setState] = useState<State>('loading')
  const [busy, setBusy] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    try { setDismissed(localStorage.getItem(DISMISS_KEY) === '1') } catch {}
    ;(async () => {
      if (!VAPID || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setState(typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent) && isIosBrowserTab() ? 'ios-install' : 'unsupported')
        return
      }
      if (isIosBrowserTab()) return setState('ios-install')
      if (Notification.permission === 'denied') return setState('denied')
      const reg = await navigator.serviceWorker.register('/sw.js')
      const sub = await reg.pushManager.getSubscription()
      setState(sub ? 'on' : 'off')
    })().catch(() => setState('unsupported'))
  }, [])

  useEffect(() => {
    if (state === 'unsupported') onUnavailable?.()
  }, [state, onUnavailable])

  const turnOn = async () => {
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return setState(permission === 'denied' ? 'denied' : 'off')
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) }))
      const res = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub.toJSON()) })
      setState(res.ok ? 'on' : 'off')
    } catch {
      setState('off')
    } finally {
      setBusy(false)
    }
  }

  const turnOff = async () => {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) })
        await sub.unsubscribe()
      }
      setState('off')
    } finally {
      setBusy(false)
    }
  }

  if (variant === 'menu') {
    if (state === 'loading' || state === 'unsupported') return null
    return (
      <button
        onClick={state === 'on' ? turnOff : state === 'off' ? turnOn : undefined}
        disabled={busy || state === 'ios-install' || state === 'denied'}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-50 text-left disabled:hover:bg-transparent"
      >
        {state === 'on' ? <Bell className="h-4 w-4 text-orange-500" /> : <BellOff className="h-4 w-4 text-zinc-500" />}
        <span className="flex-1">Notifications</span>
        <span className="text-[10px] font-semibold text-zinc-500">
          {state === 'on' ? 'On' : state === 'off' ? 'Off' : state === 'denied' ? 'Blocked' : 'Add to Home Screen'}
        </span>
      </button>
    )
  }

  if (variant === 'inline') {
    if (state === 'loading' || state === 'unsupported') return null
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-3 space-y-2">
        <div className="flex items-start gap-2">
          <Bell className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
          <div className="text-xs text-zinc-600">
            <div className="text-sm font-bold text-zinc-900">Phone notifications</div>
            {state === 'on' ? (
              'On — you’ll hear when a match needs your confirmation or a result you recorded is confirmed.'
            ) : state === 'ios-install' ? (
              <>On iPhone, add PadelTrack to your Home Screen first: tap <Share className="inline h-3 w-3 -mt-0.5" /> Share, then <strong>Add to Home Screen</strong>, and turn them on from there.</>
            ) : state === 'denied' ? (
              'Blocked for PadelTrack — allow them in your phone’s settings if you’d like them.'
            ) : (
              'Hear straight away when a match needs your confirmation, or a result you recorded is confirmed.'
            )}
          </div>
        </div>
        {state === 'off' && (
          <button type="button" onClick={turnOn} disabled={busy} className="w-full py-2 rounded-xl text-sm font-bold bg-zinc-900 text-white disabled:opacity-50">
            {busy ? 'Turning on…' : 'Turn on notifications'}
          </button>
        )}
      </div>
    )
  }

  // Card: only while they could turn it on and haven't dismissed it.
  if (dismissed || !['off', 'ios-install', 'denied'].includes(state)) return null
  const dismiss = () => {
    setDismissed(true)
    try { localStorage.setItem(DISMISS_KEY, '1') } catch {}
  }
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 space-y-2">
      <div className="flex items-start gap-2">
        <Bell className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-bold">Get notified on your phone</div>
          <div className="text-xs text-zinc-600">
            {state === 'ios-install' ? (
              <>On iPhone, first add PadelTrack to your Home Screen: tap <Share className="inline h-3 w-3 -mt-0.5" /> Share, then <strong>Add to Home Screen</strong>, and open it from there.</>
            ) : state === 'denied' ? (
              'Notifications are blocked for PadelTrack. Allow them in your phone’s settings to hear when a match needs you.'
            ) : (
              'Hear straight away when a match needs your confirmation, or a result you recorded is confirmed.'
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        {state === 'off' && (
          <button onClick={turnOn} disabled={busy} className="flex-1 py-2 rounded-xl text-sm font-bold bg-orange-500 text-white disabled:opacity-50">
            {busy ? 'Turning on…' : 'Turn on notifications'}
          </button>
        )}
        <button onClick={dismiss} className="px-4 py-2 rounded-xl text-sm font-semibold text-zinc-500">Not now</button>
      </div>
    </div>
  )
}
