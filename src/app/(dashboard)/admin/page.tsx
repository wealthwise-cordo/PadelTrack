import { notFound, redirect } from 'next/navigation'
import { requireSession } from '@/lib/session'
import { getRole } from '@/lib/roles'

// Admin opens on the first tab you can see: Analytics for the super user,
// Ratings for a leveller.
export default async function AdminIndex() {
  const session = await requireSession()
  const role = await getRole(session.userId)
  if (role === 'superuser') redirect('/admin/analytics')
  if (role === 'leveller') redirect('/admin/ratings')
  notFound()
}
