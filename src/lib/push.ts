import webpush from 'web-push'
import { prisma } from '@/lib/prisma'

// Phone notifications (Web Push). PadelTrack's only emails are account
// creation and password resets; everything about matches and leagues is an
// in-app badge plus, for players who turned them on, a push notification.
//
// Needs NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT.
// Without them nothing is sent. Sending never throws: a failed notification
// must not undo the match or score that triggered it.

export type PushMessage = { title: string; body: string; url: string; tag?: string }

let configured: boolean | null = null
function configure(): boolean {
  if (configured !== null) return configured
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return (configured = false)
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:hello@padeltrack.co.uk', pub, priv)
  return (configured = true)
}

// Sends to every device of the given users. Devices the push service says
// are gone (404/410) are removed.
export async function sendPush(userIds: (string | null | undefined)[], message: PushMessage): Promise<void> {
  try {
    const ids = Array.from(new Set(userIds.filter((x): x is string => !!x)))
    if (!ids.length || !configure()) return
    const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: ids } } })
    await Promise.all(subs.map(async s => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(message), { TTL: 60 * 60 * 24 })
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) await prisma.pushSubscription.deleteMany({ where: { id: s.id } })
        else console.error('sendPush', e)
      }
    }))
  } catch (e) {
    console.error('sendPush', e)
  }
}

// The users behind a set of player ids (guests have none).
export async function usersOfPlayers(playerIds: string[]): Promise<string[]> {
  const rows = await prisma.player.findMany({ where: { id: { in: playerIds }, userId: { not: null } }, select: { userId: true } })
  return rows.map(r => r.userId!)
}
