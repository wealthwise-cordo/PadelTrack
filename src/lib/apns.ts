import http2 from 'http2'
import { createPrivateKey, sign } from 'crypto'

// Apple Push Notification service: notifications for the iPhone app (Web
// Push covers browsers and home-screen installs; see push.ts).
//
// Needs APNS_KEY (the contents of the .p8 key from the Apple developer
// account; newlines may be written as \n), APNS_KEY_ID and APPLE_TEAM_ID.
// Without them nothing is sent.

const BUNDLE_ID = process.env.APNS_BUNDLE_ID || 'uk.co.padeltrack.app'
const PRODUCTION = 'https://api.push.apple.com'
// Builds run from Xcode get development tokens, which only this host accepts.
const SANDBOX = 'https://api.sandbox.push.apple.com'

export type ApnsMessage = { title: string; body: string; url: string; tag?: string }

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url')

// Apple wants a fresh signed token at most hourly, and no more often than
// every 20 minutes.
let cached: { token: string; at: number } | null = null
function authToken(): string | null {
  const key = process.env.APNS_KEY
  const keyId = process.env.APNS_KEY_ID
  const teamId = process.env.APPLE_TEAM_ID
  if (!key || !keyId || !teamId) return null
  if (cached && Date.now() - cached.at < 45 * 60_000) return cached.token
  const head = b64url(JSON.stringify({ alg: 'ES256', kid: keyId }))
  const claims = b64url(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }))
  const signature = sign('sha256', Buffer.from(`${head}.${claims}`), {
    key: createPrivateKey(key.replace(/\\n/g, '\n')),
    dsaEncoding: 'ieee-p1363',
  })
  cached = { token: `${head}.${claims}.${b64url(signature)}`, at: Date.now() }
  return cached.token
}

type Reply = { status: number; reason?: string }

function post(client: http2.ClientHttp2Session, deviceToken: string, auth: string, payload: string, tag?: string): Promise<Reply> {
  return new Promise(resolve => {
    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${auth}`,
      'apns-topic': BUNDLE_ID,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-expiration': String(Math.floor(Date.now() / 1000) + 24 * 3600),
      // A newer notification about the same match replaces the older one.
      ...(tag && Buffer.byteLength(tag) <= 64 && { 'apns-collapse-id': tag }),
    })
    let status = 0
    let body = ''
    req.on('response', h => { status = Number(h[':status']) })
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      let reason: string | undefined
      try { reason = JSON.parse(body).reason } catch {}
      resolve({ status, reason })
    })
    req.on('error', () => resolve({ status: 0 }))
    req.end(payload)
  })
}

async function sendAll(host: string, tokens: string[], auth: string, payload: string, tag?: string): Promise<Map<string, Reply>> {
  const client = http2.connect(host)
  client.on('error', () => {})
  try {
    const replies = await Promise.all(tokens.map(t => post(client, t, auth, payload, tag)))
    return new Map(tokens.map((t, i) => [t, replies[i]]))
  } finally {
    client.close()
  }
}

// Sends to the given device tokens. Returns the tokens Apple says are no
// longer valid, so the caller can forget them.
export async function sendApns(tokens: string[], message: ApnsMessage): Promise<string[]> {
  const auth = authToken()
  if (!auth || !tokens.length) return []
  const payload = JSON.stringify({
    aps: { alert: { title: message.title, body: message.body }, sound: 'default', ...(message.tag && { 'thread-id': message.tag }) },
    url: message.url,
  })
  const gone: string[] = []
  const prod = await sendAll(PRODUCTION, tokens, auth, payload, message.tag)
  // A development token (an Xcode build) is "bad" in production: try the sandbox.
  const retry = tokens.filter(t => prod.get(t)?.reason === 'BadDeviceToken')
  const sandbox = retry.length ? await sendAll(SANDBOX, retry, auth, payload, message.tag) : new Map<string, Reply>()
  for (const t of tokens) {
    const r = sandbox.get(t) ?? prod.get(t)
    if (!r || r.status === 200) continue
    if (r.status === 410 || r.reason === 'BadDeviceToken' || r.reason === 'Unregistered') gone.push(t)
    else console.error('sendApns', r.status, r.reason)
  }
  return gone
}
