'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Check, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SeasonOption = { id: string; name: string; location: string; status: string }

const COOKIE = 'viewSeasonId'

// Per-viewer season picker. Only changes which season *this browser* is
// looking at (via a cookie the server reads); season lifecycle — opening,
// closing, reopening — stays in the admin panel.
export default function SeasonSwitcher({
  seasons,
  viewedSeasonId,
  activeSeasonId,
  label,
  className,
}: {
  seasons: SeasonOption[]
  viewedSeasonId: string | null
  activeSeasonId: string | null
  label: string
  className?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const select = (id: string) => {
    setOpen(false)
    if (id === viewedSeasonId) return
    // Picking the active season clears the preference, so the viewer
    // automatically follows whichever season is live from then on.
    document.cookie = id === activeSeasonId
      ? `${COOKIE}=; path=/; max-age=0; samesite=lax`
      : `${COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`
    startTransition(() => router.refresh())
  }

  if (seasons.length === 0) return <span className={className}>{label}</span>

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn('inline-flex items-center gap-0.5 hover:text-foreground transition-colors', pending && 'opacity-60', className)}
      >
        {label}
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 top-full mt-1.5 z-[60] min-w-[160px] rounded-xl border border-white/10 bg-black/95 backdrop-blur p-1 shadow-xl normal-case tracking-normal"
        >
          {seasons.map(s => {
            const selected = s.id === viewedSeasonId
            return (
              <li key={s.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => select(s.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors',
                    selected ? 'bg-neon-green/10 text-neon-green' : 'text-foreground/90 hover:bg-white/5'
                  )}
                >
                  <span className="flex-1 whitespace-nowrap">
                    <span className="font-semibold">{s.name}</span>
                    <span className="text-muted-foreground"> - {s.location}</span>
                  </span>
                  {s.status === 'active' ? (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-neon-green/15 text-neon-green font-bold uppercase tracking-wide">
                      Live
                    </span>
                  ) : (
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  )}
                  <Check className={cn('h-3 w-3', selected ? 'opacity-100' : 'opacity-0')} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
