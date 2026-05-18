import MatchCard from '@/components/matches/MatchCard'
import { getMatches } from '@/lib/store'
import Link from 'next/link'
import { Plus, Pencil } from 'lucide-react'

export const revalidate = 0

export default async function MatchHistoryPage() {
  const matches = await getMatches()

  return (
    <div className="py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight">Match History</h1>
        <Link
          href="/matches/new"
          className="flex items-center gap-1.5 text-sm font-medium text-neon-green bg-neon-green/10 rounded-lg px-3 py-1.5 hover:bg-neon-green/20 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New
        </Link>
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground text-sm">
          No matches recorded yet.
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map(m => (
            <MatchCard key={m.id} match={m as any} />
          ))}
        </div>
      )}

      {/* Admin access */}
      <div className="flex justify-center pt-2 pb-4">
        <Link
          href="/admin"
          className="flex items-center gap-1.5 text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        >
          <Pencil className="h-3 w-3" />
          Manage
        </Link>
      </div>
    </div>
  )
}
