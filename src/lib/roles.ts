import { prisma } from '@/lib/prisma'
import { isAdminEmail } from '@/lib/analytics'

// Who can do what beyond playing:
//   member    — everyone.
//   leveller  — can propose rating adjustments, which the super user reviews.
//   superuser — sees analytics, adjusts ratings without review, reviews
//               levellers' adjustments and appoints levellers.
// Anyone in ADMIN_EMAILS is a super user whatever their stored role, so a
// database reset can't lock the owner out.
export type Role = 'member' | 'leveller' | 'superuser'

export function effectiveRole(user: { role: string; email: string } | null | undefined): Role {
  if (!user) return 'member'
  if (user.role === 'superuser' || isAdminEmail(user.email)) return 'superuser'
  if (user.role === 'leveller') return 'leveller'
  return 'member'
}

export async function getRole(userId: string): Promise<Role> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, email: true } })
  return effectiveRole(u)
}

export const canAdjustRatings = (role: Role) => role === 'leveller' || role === 'superuser'
