'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Radio, Eye, Crown } from 'lucide-react'

const POLL_MS = 5_000

// Keeps an event in sync for everyone in it: while it's in progress, the page
// re-fetches every few seconds so scores entered on anyone's phone show up.
export default function EventLiveBar({
  live,
  organiserName,
  role,
}: {
  live: boolean
  organiserName: string
  role: 'organiser' | 'player' | 'viewer'
}) {
  const router = useRouter()
  const [lastSync, setLastSync] = useState<number | null>(null)

  useEffect(() => {
    if (!live) return
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      router.refresh()
      setLastSync(Date.now())
    }
    const id = setInterval(tick, POLL_MS)
    // Catch up straight away when someone comes back to the tab.
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [live, router])

  return (
    <div className="mt-5 flex items-center gap-2 rounded-xl bg-zinc-900 text-white px-3.5 py-2.5 text-xs">
      {role === 'organiser' ? <Crown className="h-3.5 w-3.5 text-orange-500 shrink-0" /> : role === 'player' ? <Radio className="h-3.5 w-3.5 text-orange-500 shrink-0" /> : <Eye className="h-3.5 w-3.5 text-zinc-400 shrink-0" />}
      <span className="flex-1 min-w-0 truncate text-zinc-300">
        {role === 'organiser'
          ? 'You organised this event — players in it can enter scores too'
          : role === 'player'
            ? <>Organised by <span className="font-semibold text-white">{organiserName}</span> — you can enter scores</>
            : <>Organised by <span className="font-semibold text-white">{organiserName}</span> — view only</>}
      </span>
      {live ? (
        <span className="flex items-center gap-1.5 font-semibold text-orange-500 shrink-0" title={lastSync ? `Last synced ${new Date(lastSync).toLocaleTimeString()}` : undefined}>
          <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-ptr-pulse" /> Live
        </span>
      ) : (
        <span className="font-semibold text-zinc-400 shrink-0">Finished</span>
      )}
    </div>
  )
}
