'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Trophy, History, LayoutGrid, Plus, LogOut, User, BarChart3 } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'

const tabs = [
  { href: '/', label: 'Ranking', icon: Trophy },
  { href: '/matches', label: 'Match Centre', icon: History },
  { href: '/events', label: 'Events & Leagues', icon: LayoutGrid },
]

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/' || pathname.startsWith('/players')
  if (href === '/matches') return pathname === '/matches'
  return pathname.startsWith(href)
}

export default function Navbar({
  me,
  pendingCount,
  isAdmin = false,
}: {
  me: { playerId: string; name: string; avatarColor: string }
  pendingCount: number
  isAdmin?: boolean
}) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMenuOpen(false), [pathname])
  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  return (
    <header className="sticky top-0 z-50 bg-zinc-900 text-white shadow-md [padding-top:env(safe-area-inset-top)]">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center">
            <Trophy className="h-4 w-4 text-white" />
          </span>
          <span className="font-black text-lg tracking-tight">
            Padel<span className="text-orange-500">Track</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-4">
          {tabs.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive(pathname, href) ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
              {href === '/matches' && pendingCount > 0 && <Badge count={pendingCount} />}
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        <Link
          href="/matches/new"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold whitespace-nowrap bg-orange-500 text-white hover:bg-orange-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Match</span>
          <span className="sm:hidden">New</span>
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white ring-2 ring-white/10 hover:ring-orange-500 transition"
            style={{ backgroundColor: me.avatarColor }}
            aria-label="Account menu"
          >
            {getInitials(me.name)}
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 z-50 rounded-xl bg-white text-zinc-900 shadow-lg border border-zinc-200 py-1 text-sm">
              <div className="px-3 py-2 border-b border-zinc-100">
                <div className="font-semibold truncate">{me.name}</div>
              </div>
              <Link href={`/players/${me.playerId}`} className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-50">
                <User className="h-4 w-4 text-zinc-500" /> My profile
              </Link>
              {isAdmin && (
                <Link href="/admin" className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-50">
                  <BarChart3 className="h-4 w-4 text-zinc-500" /> Analytics
                </Link>
              )}
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-50 text-left"
              >
                <LogOut className="h-4 w-4 text-zinc-500" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs — mobile, part of the same sticky header */}
      <nav className="md:hidden flex border-t border-white/10">
        {tabs.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'relative flex-auto flex items-center justify-center gap-1 px-1.5 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors',
              isActive(pathname, href) ? 'border-orange-500 text-white' : 'border-transparent text-zinc-400'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {href === '/matches' && pendingCount > 0 && <Badge count={pendingCount} />}
          </Link>
        ))}
      </nav>
    </header>
  )
}

function Badge({ count }: { count: number }) {
  return (
    <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
      {count}
    </span>
  )
}
