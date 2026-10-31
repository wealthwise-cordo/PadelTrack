import webpush from 'web-push'
import { prisma } from '@/lib/prisma'
import { sendApns } from '@/lib/apns'

// Phone notifications: Web Push, plus Apple's push service for the iPhone app
// (apns.ts). PadelTrack's only emails are account
// creation and password resets; everything about matches and leagues is an
// in-app badge plus, for players who turned them on, a push notification.
//
// Web Push needs NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and
// VAPID_SUBJECT; without them only the app's notifications are sent. Sending never throws: a failed notification
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
    if (!ids.length) return
    await Promise.all([sendWebPush(ids, message), sendAppPush(ids, message)])
  } catch (e) {
    console.error('sendPush', e)
  }
}

async function sendAppPush(userIds: string[], message: PushMessage) {
  const rows = await prisma.nativePushToken.findMany({ where: { userId: { in: userIds } }, select: { token: true } })
  const gone = await sendApns(rows.map(r => r.token), message)
  if (gone.length) await prisma.nativePushToken.deleteMany({ where: { token: { in: gone } } })
}

async function sendWebPush(userIds: string[], message: PushMessage) {
  if (!configure()) return
  const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } })
  await Promise.all(subs.map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(message), { TTL: 60 * 60 * 24 })
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) await prisma.pushSubscription.deleteMany({ where: { id: s.id } })
      else console.error('sendPush', e)
    }
  }))
}

// The users behind a set of player ids (guests have none).
export async function usersOfPlayers(playerIds: string[]): Promise<string[]> {
  const rows = await prisma.player.findMany({ where: { id: { in: playerIds }, userId: { not: null } }, select: { userId: true } })
  return rows.map(r => r.userId!)
}
