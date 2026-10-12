import { getInitials } from '@/lib/utils'
import type { PlayerWithStats } from '@/types'

export type Players = Map<string, PlayerWithStats>

// A pair's two avatars and first names, e.g. "Sam & Alex".
export default function TeamPill({ p1, p2, byId }: { p1: string; p2: string; byId: Players }) {
  const first = (id: string) => byId.get(id)?.name.split(' ')[0] ?? '—'
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="flex -space-x-1.5 shrink-0">
        {[p1, p2].map(id => {
          const p = byId.get(id)
          if (!p) return null
          return (
            <div
              key={id}
              className="h-7 w-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-white"
              style={{ backgroundColor: p.avatarColor }}
            >
              {getInitials(p.name)}
            </div>
          )
        })}
      </div>
      <span className="text-xs font-semibold truncate">{first(p1)} &amp; {first(p2)}</span>
    </div>
  )
}
