'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

// The Admin section's tabs, with a count where something needs attention.
export default function AdminTabs({ tabs }: { tabs: { href: string; label: string; count: number }[] }) {
  const pathname = usePathname()
  return (
    <nav className="flex gap-1 p-1 rounded-xl bg-zinc-100" aria-label="Admin sections">
      {tabs.map(t => {
        const active = pathname.startsWith(t.href)
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 h-9 rounded-lg text-xs font-bold whitespace-nowrap transition',
              active ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
            )}
          >
            {t.label}
            {t.count > 0 && <span className={cn('text-[10px] font-semibold', active ? 'text-zinc-400' : 'text-orange-600')}>{t.count}</span>}
          </Link>
        )
      })}
    </nav>
  )
}
