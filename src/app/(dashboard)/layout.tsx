import Navbar from '@/components/shared/Navbar'
import AutoSync from '@/components/shared/AutoSync'
import { requireSession } from '@/lib/session'
import { getPendingForUser, getSyncFingerprint } from '@/lib/store'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  const [pending, fingerprint] = await Promise.all([getPendingForUser(session.userId), getSyncFingerprint()])

  return (
    <div className="min-h-screen bg-white">
      <AutoSync initial={fingerprint} />
      <Navbar
        me={{ playerId: session.player.id, name: session.player.name, avatarColor: session.player.avatarColor }}
        pendingCount={pending.length}
      />
      <main className="px-4 pb-10 max-w-3xl mx-auto">
        {children}
      </main>
    </div>
  )
}
