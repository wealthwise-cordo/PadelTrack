'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import AccountActions from '@/components/admin/AccountActions'

type User = {
  playerId: string; name: string; avatarColor: string; matchesPlayed: number
  email: string; joinedAt: string; suspended: boolean; isSuperUser: boolean; userId: string
}

// Admin → Users: every account, searchable by name or email. Tap one for
// Suspend / Delete account (admin password and a reason needed).
export default function AllUsers({ users, meUserId }: { users: User[]; meUserId: string }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const term = q.trim().toLowerCase()
  const shown = term ? users.filter(u => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)) : users
  const joined = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="space-y-3">
      <input
        value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or email" autoComplete="off"
        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-orange-500"
      />
      {shown.length === 0 ? (
        <p className="text-sm text-zinc-500">No users match “{q.trim()}”.</p>
      ) : (
        <ul className="glass rounded-xl divide-y divide-zinc-100">
          {shown.map(u => {
            const canAct = !u.isSuperUser && u.userId !== meUserId
            const isOpen = open === u.playerId
            return (
              <li key={u.playerId} className="px-3 py-2.5">
                <button
                  onClick={() => canAct && setOpen(isOpen ? null : u.playerId)}
                  className={`w-full flex items-center gap-3 text-left ${canAct ? '' : 'cursor-default'}`}
                  aria-expanded={canAct ? isOpen : undefined}
                >
                  <span className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: u.avatarColor }}>
                    {getInitials(u.name)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm font-semibold truncate">{u.name}</span>
                      {u.suspended && <span className="text-[9px] font-semibold text-red-700 bg-red-100 rounded px-1 py-0.5 shrink-0">SUSPENDED</span>}
                      {u.isSuperUser && <span className="text-[9px] font-semibold text-zinc-600 bg-zinc-100 rounded px-1 py-0.5 shrink-0">SUPER USER</span>}
                    </span>
                    <span className="block text-[11px] text-zinc-500 truncate">{u.email}</span>
                    <span className="block text-[11px] text-zinc-400">Joined {joined(u.joinedAt)} · {u.matchesPlayed} ranked {u.matchesPlayed === 1 ? 'match' : 'matches'}</span>
                  </span>
                  {canAct && <ChevronDown className={`h-4 w-4 text-zinc-400 shrink-0 transition ${isOpen ? 'rotate-180' : ''}`} />}
                </button>
                {isOpen && (
                  <div className="mt-2.5 space-y-2">
                    <Link href={`/players/${u.playerId}`} className="text-xs font-semibold text-orange-600 hover:underline">View profile</Link>
                    <AccountActions playerId={u.playerId} name={u.name} suspended={u.suspended} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
