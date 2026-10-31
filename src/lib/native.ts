'use client'

import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { Share } from '@capacitor/share'

// The iPhone app (ios/, capacitor.config.ts) loads this site in a native
// shell. These helpers use the phone's own features there and fall back to
// the browser's everywhere else.

export const isNativeApp = () => Capacitor.isNativePlatform()

const TOKEN_KEY = 'pt-native-push-token'

// Shares a link with the phone's share sheet, or copies it. Returns 'copied'
// when it fell back to the clipboard (so the button can say so).
export async function shareLink(link: { title: string; text: string; url: string }): Promise<'shared' | 'copied'> {
  if (isNativeApp()) {
    try {
      await Share.share({ title: link.title, text: link.text, url: link.url, dialogTitle: link.title })
    } catch {
      // Share sheet dismissed.
    }
    return 'shared'
  }
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share(link)
      return 'shared'
    } catch {
      // Share sheet dismissed — fall through to copying.
    }
  }
  await navigator.clipboard.writeText(link.url)
  return 'copied'
}

// --- Notifications in the app ------------------------------------------------

export type NativePushState = 'on' | 'off' | 'denied'

// The first-open "turn on notifications?" screen shows once per phone.
const ASKED_KEY = 'pt-native-push-asked'

// Whether to show it: in the app, not shown before, and the phone hasn't
// been asked yet (iOS only lets the app show its own pop-up once).
export async function shouldAskForPush(): Promise<boolean> {
  if (!isNativeApp()) return false
  try { if (localStorage.getItem(ASKED_KEY)) return false } catch { return false }
  const { receive } = await PushNotifications.checkPermissions()
  return receive === 'prompt' || receive === 'prompt-with-rationale'
}

export function markAskedForPush() {
  try { localStorage.setItem(ASKED_KEY, '1') } catch {}
}

export async function nativePushState(): Promise<NativePushState> {
  const { receive } = await PushNotifications.checkPermissions()
  if (receive === 'denied') return 'denied'
  return receive === 'granted' && readToken() ? 'on' : 'off'
}

// Asks for permission (once), registers with Apple and saves this phone's
// token for the signed-in user. Resolves to the resulting state.
export async function enableNativePush(): Promise<NativePushState> {
  try {
    return await registerForPush()
  } finally {
    window.dispatchEvent(new Event(NATIVE_PUSH_EVENT))
  }
}

async function registerForPush(): Promise<NativePushState> {
  let { receive } = await PushNotifications.checkPermissions()
  if (receive === 'prompt' || receive === 'prompt-with-rationale') receive = (await PushNotifications.requestPermissions()).receive
  if (receive !== 'granted') return receive === 'denied' ? 'denied' : 'off'
  const token = await new Promise<string | null>(resolve => {
    const done = (value: string | null) => {
      clearTimeout(timer)
      void ok.then(h => h.remove())
      void failed.then(h => h.remove())
      resolve(value)
    }
    const timer = setTimeout(() => done(null), 15_000)
    const ok = PushNotifications.addListener('registration', t => done(t.value))
    const failed = PushNotifications.addListener('registrationError', () => done(null))
    void PushNotifications.register()
  })
  if (!token || !(await saveToken(token))) return 'off'
  return 'on'
}

export async function disableNativePush(): Promise<void> {
  await forgetThisDevice()
  await PushNotifications.unregister().catch(() => {})
}

// Stops this phone getting the signed-in user's notifications (turning them
// off, or signing out).
export async function forgetThisDevice(): Promise<void> {
  if (!isNativeApp()) return
  const token = readToken()
  if (!token) return
  await fetch('/api/push/native', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }).catch(() => {})
  writeToken(null)
}

// Apple can change a phone's token: saves the current one for whoever is
// signed in. Called on every app launch once notifications are allowed.
export async function saveToken(token: string): Promise<boolean> {
  const res = await fetch('/api/push/native', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }).catch(() => null)
  if (res?.ok) writeToken(token)
  return !!res?.ok
}

function readToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

// Every notifications toggle on screen listens for this to stay in step.
export const NATIVE_PUSH_EVENT = 'pt-native-push'

function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {}
  window.dispatchEvent(new Event(NATIVE_PUSH_EVENT))
}
