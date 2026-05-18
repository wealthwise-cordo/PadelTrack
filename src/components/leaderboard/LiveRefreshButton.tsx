'use client'

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

const INTERVAL_MS = 30_000

export default function LiveRefreshButton() {
  const router = useRouter()

  const refresh = useCallback(() => router.refresh(), [router])

  useEffect(() => {
    const id = setInterval(refresh, INTERVAL_MS)
    return () => clearInterval(id)
  }, [refresh])

  return (
    <button
      onClick={refresh}
      className="flex items-center gap-1.5 text-xs text-neon-green bg-neon-green/10 rounded-full px-3 py-1.5 hover:bg-neon-green/20 active:scale-95 transition-all"
    >
      <div className="h-1.5 w-1.5 rounded-full bg-neon-green animate-ptr-pulse" />
      Live
      <RefreshCw className="h-2.5 w-2.5 opacity-60" />
    </button>
  )
}
