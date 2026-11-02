'use client'

// fetch for super-user actions: if the server says the admin password is
// needed (423, see admin-auth.ts), asks for it in AdminUnlockDialog and tries
// once more. Returns the last response either way.
export const ADMIN_UNLOCK_EVENT = 'pt-admin-unlock'
// Sent when admin actions are unlocked (detail: when that runs out, ms) or
// locked again (detail: null), for the lock icon in Admin's heading.
export const ADMIN_LOCK_STATE_EVENT = 'pt-admin-lock-state'
export const announceLockState = (until: number | null) => window.dispatchEvent(new CustomEvent<number | null>(ADMIN_LOCK_STATE_EVENT, { detail: until }))
export type UnlockRequest = { needsSetup: boolean; resolve: (unlocked: boolean) => void }

export async function adminFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init)
  if (res.status !== 423) return res
  announceLockState(null)
  const body = await res.clone().json().catch(() => ({}))
  const unlocked = await new Promise<boolean>(resolve =>
    window.dispatchEvent(new CustomEvent<UnlockRequest>(ADMIN_UNLOCK_EVENT, { detail: { needsSetup: !!body.needsSetup, resolve } })))
  return unlocked ? fetch(url, init) : res
}
