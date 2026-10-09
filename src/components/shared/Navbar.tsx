'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Trophy, Swords, History, BarChart3, LayoutGrid, Calendar } from 'lucide-react'
import { cn, seasonLabel } from '@/lib/utils'
import SeasonSwitcher, { type SeasonOption } from '@/components/shared/SeasonSwitcher'

const sideNav = [
  { href: '/', label: 'Rankings', icon: Trophy },
  { href: '/stats', label: 'Stats', icon: BarChart3 },
]

const sideNavRight = [
  { href: '/events', label: 'Events', icon: LayoutGrid },
  { href: '/matches', label: 'History', icon: History },
]

const desktopNav = [
  { href: '/', label: 'Rankings', icon: Trophy },
  { href: '/stats', label: 'Stats', icon: BarChart3 },
  { href: '/matches/new', label: 'New Match', icon: Swords },
  { href: '/events', label: 'Events', icon: LayoutGrid },
  { href: '/matches', label: 'History', icon: History },
  { href: '/seasons', label: 'Seasons', icon: Calendar },
]

export default function Navbar({
  seasons,
  viewedSeason,
  activeSeasonId,
}: {
  seasons: SeasonOption[]
  viewedSeason: SeasonOption | null
  activeSeasonId: string | null
}) {
  const pathname = usePathname()
  // New scores always go to the live season, so hide the shortcut while
  // browsing a closed one to avoid recording into a season you're not viewing.
  const viewingPast = !!viewedSeason && viewedSeason.status !== 'active'

  return (
    <>
      {/* Top bar — desktop */}
      <header className="hidden md:flex fixed top-0 left-0 right-0 z-50 h-14 items-center justify-between px-6 glass border-b border-white/10">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-neon-green" />
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-sm tracking-widest text-foreground/90">
              WORLD PADEL <span className="text-neon-green">TOUR</span>
            </span>
            <SeasonSwitcher
              seasons={seasons}
              viewedSeasonId={viewedSeason?.id ?? null}
              activeSeasonId={activeSeasonId}
              label={viewedSeason ? seasonLabel(viewedSeason) : 'No active season'}
              className="text-[10px] text-muted-foreground tracking-widest uppercase"
            />
          </div>
        </div>
        <nav className="flex items-center gap-1">
          {desktopNav.filter(({ href }) => !(viewingPast && href === '/matches/new')).map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                href === '/matches/new'
                  ? 'bg-neon-orange/10 text-neon-orange hover:bg-neon-orange/20'
                  : pathname === href
                  ? 'bg-neon-green/10 text-neon-green'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="w-24" />
      </header>

      {/* Bottom bar — mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex glass !bg-black/90 backdrop-blur border-t border-white/10 [padding-bottom:env(safe-area-inset-bottom)]">
        {sideNav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-all',
              pathname === href ? 'text-neon-green' : 'text-muted-foreground'
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}

        {/* Centre — New Match */}
        {!viewingPast && (
          <Link
            href="/matches/new"
            className="flex-1 flex flex-col items-center gap-1 py-2 text-[10px] font-bold transition-all text-neon-orange"
          >
            <Swords className="h-5 w-5" />
            New Match
          </Link>
        )}

        {sideNavRight.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-all',
              pathname === href ? 'text-neon-green' : 'text-muted-foreground'
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>
    </>
  )
}
