'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export const SYNC_INTERVAL_MS = 20_000

// Keeps every signed-in page current without a refresh button. Every 20
// seconds (and whenever the tab comes back into view) it asks the server
// whether anything has changed, and re-renders only if it has.
export default function AutoSync({ initial }: { initial: string }) {
  const router = useRouter()
  const last = useRef(initial)

  useEffect(() => {
    last.current = initial
  }, [initial])

  useEffect(() => {
    let inFlight = false
    const check = async () => {
      if (inFlight || document.visibilityState !== 'visible') return
      inFlight = true
      try {
        const res = await fetch('/api/sync', { cache: 'no-store' })
        if (!res.ok) return
        const { v } = await res.json()
        if (v !== last.current) {
          last.current = v
          router.refresh()
        }
      } catch {
        // Offline or a blip — try again next tick.
      } finally {
        inFlight = false
      }
    }
    const id = setInterval(check, SYNC_INTERVAL_MS)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', check)
    }
  }, [router])

  return null
}
