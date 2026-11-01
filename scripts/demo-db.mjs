// A throwaway PostgreSQL on this Mac for local development and App Store
// screenshots — never the live database. Uses the localhost connection in
// .env (storage_POSTGRES_PRISMA_URL); data lives in .demo-db/ (git-ignored).
// Run: npm run demo:db   (keeps running; Ctrl-C to stop)
import EmbeddedPostgres from 'embedded-postgres'
import { existsSync } from 'fs'

const url = new URL(process.env.storage_POSTGRES_PRISMA_URL ?? '')
if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
  console.error('Refusing: storage_POSTGRES_PRISMA_URL is not a localhost database.')
  process.exit(1)
}

const dir = new URL('../.demo-db', import.meta.url).pathname
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  port: Number(url.port || 5432),
  persistent: true,
})

const fresh = !existsSync(dir)
if (fresh) await pg.initialise()
await pg.start()
const db = url.pathname.slice(1)
if (fresh) await pg.createDatabase(db)
console.log(`Demo database ready on localhost:${url.port}/${db}`)

const stop = async () => { await pg.stop(); process.exit(0) }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
