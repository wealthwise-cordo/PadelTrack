import Navbar from '@/components/shared/Navbar'
import AutoSync from '@/components/shared/AutoSync'
import { requireSession } from '@/lib/session'
import { getPendingForUser, getSyncFingerprint, getAccount } from '@/lib/store'
import { getRole } from '@/lib/roles'
import { countPendingAdjustments } from '@/lib/rating-adjustments'
import { countDisputes } from '@/lib/admin-matches'
import { countAwaitingScore } from '@/lib/scheduled-matches'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  const [pending, fingerprint, account, role, toScore] = await Promise.all([getPendingForUser(session.userId), getSyncFingerprint(), getAccount(session.userId), getRole(session.userId), countAwaitingScore(session.player.id)])
  const reviewCount = role === 'superuser' ? (await countPendingAdjustments()) + (await countDisputes(session.player.id)) : 0

  return (
    <div className="min-h-screen bg-white">
      <AutoSync initial={fingerprint} />
      <Navbar
        me={{ playerId: session.player.id, name: session.player.name, avatarColor: session.player.avatarColor }}
        pendingCount={pending.length + toScore}
        role={role}
        reviewCount={reviewCount}
        profileIncomplete={!!account?.profileIncomplete}
      />
      <main className="px-4 pb-10 max-w-3xl mx-auto">
        {children}
      </main>
    </div>
  )
}
