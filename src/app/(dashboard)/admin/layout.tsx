import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/session'
import { getRole, canAdjustRatings } from '@/lib/roles'
import { countPendingAdjustments } from '@/lib/rating-adjustments'
import { countDisputes } from '@/lib/admin-matches'
import { getGuestsAwaitingJoin } from '@/lib/admin-users'
import AdminTabs from '@/components/admin/AdminTabs'

// Everything admin under one heading. The super user sees Analytics,
// Ratings, Matches and Users; a leveller only Ratings. Members get a 404.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  const role = await getRole(session.userId)
  if (!canAdjustRatings(role)) notFound()
  const isSuper = role === 'superuser'
  const [reviews, disputes, waitingGuests] = isSuper
    ? await Promise.all([countPendingAdjustments(), countDisputes(session.player.id), getGuestsAwaitingJoin().then(g => g.length)])
    : [0, 0, 0]

  const tabs = [
    ...(isSuper ? [{ href: '/admin/analytics', label: 'Analytics', count: 0 }] : []),
    { href: '/admin/ratings', label: 'Ratings', count: reviews },
    ...(isSuper ? [{ href: '/admin/matches', label: 'Matches', count: disputes }] : []),
    ...(isSuper ? [{ href: '/admin/users', label: 'Users', count: waitingGuests }] : []),
  ]
  return (
    <div className="py-6 space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-black tracking-tight">Admin</h1>
        <AdminTabs tabs={tabs} />
      </div>
      {children}
    </div>
  )
}
