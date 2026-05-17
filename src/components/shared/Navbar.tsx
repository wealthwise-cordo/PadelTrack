'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Trophy, Swords, History, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/', label: 'Rankings', icon: Trophy },
  { href: '/matches/new', label: 'New Match', icon: Swords },
  { href: '/matches', label: 'History', icon: History },
  { href: '/stats', label: 'Stats', icon: BarChart3 },
]

export default function Navbar() {
  const pathname = usePathname()

  return (
    <>
      {/* Top bar — desktop */}
      <header className="hidden md:flex fixed top-0 left-0 right-0 z-50 h-14 items-center justify-between px-6 glass border-b border-white/10">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-neon-green" />
          <span className="font-bold text-sm tracking-widest text-foreground/90">
            PTR <span className="text-neon-green">PADEL</span>
          </span>
        </div>
        <nav className="flex items-center gap-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                pathname === href
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex glass border-t border-white/10">
        {nav.map(({ href, label, icon: Icon }) => (
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
