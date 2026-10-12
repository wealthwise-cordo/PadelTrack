import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { autoConfirmExpired, getPlayerForUser } from '@/lib/store'
import { recordActiveDay } from '@/lib/analytics'

// The signed-in user and their player profile, or null.
export async function getSession() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return null
  // Settle any matches whose confirmation window has expired before reading
  // ratings, so every page sees up-to-date numbers.
  await autoConfirmExpired()
  const player = await getPlayerForUser(userId)
  if (!player) return null
  await recordActiveDay(userId)
  return { userId, player, name: session.user?.name ?? player.name }
}

// For pages: sends signed-out visitors to the login screen.
export async function requireSession() {
  const s = await getSession()
  if (!s) redirect('/login')
  return s
}
