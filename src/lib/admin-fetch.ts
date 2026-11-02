'use client'

// fetch for super-user actions: if the server says the admin password is
// needed (423, see admin-auth.ts), asks for it in AdminUnlockDialog and tries
// once more. Returns the last response either way.
export const ADMIN_UNLOCK_EVENT = 'pt-admin-unlock'
export type UnlockRequest = { needsSetup: boolean; resolve: (unlocked: boolean) => void }

export async function adminFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init)
  if (res.status !== 423) return res
  const body = await res.clone().json().catch(() => ({}))
  const unlocked = await new Promise<boolean>(resolve =>
    window.dispatchEvent(new CustomEvent<UnlockRequest>(ADMIN_UNLOCK_EVENT, { detail: { needsSetup: !!body.needsSetup, resolve } })))
  return unlocked ? fetch(url, init) : res
}
