import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

// Local demo data: a few accounts plus one guest. Refuses to run against
// anything but a localhost database, since every demo account shares the
// same throwaway password.
const url = process.env.storage_POSTGRES_PRISMA_URL ?? ''
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error('Refusing to seed: storage_POSTGRES_PRISMA_URL is not a localhost database.')
  process.exit(1)
}

const prisma = new PrismaClient()
const DEMO_PASSWORD = 'padeltrack-demo'

const USERS = [
  { name: 'Cord van Eck', color: '#f97316' },
  { name: 'JonJon Clark', color: '#3f3f46' },
  { name: 'Zac Schmidt', color: '#0ea5e9' },
  { name: 'Brandon Fair', color: '#8b5cf6' },
]

async function main() {
  console.log('Seeding demo data…')
  const password = await bcrypt.hash(DEMO_PASSWORD, 10)

  for (const { name, color } of USERS) {
    const email = name.toLowerCase().replace(/ /g, '.') + '@demo.padeltrack'
    const user = await prisma.user.upsert({ where: { email }, update: {}, create: { email, password, name } })
    await prisma.player.upsert({
      where: { userId: user.id },
      update: {},
      create: { name, avatarColor: color, userId: user.id },
    })
    console.log(`  ✓ ${email}`)
  }

  const owner = await prisma.user.findFirstOrThrow({ where: { email: 'cord.van.eck@demo.padeltrack' } })
  if (!(await prisma.player.findFirst({ where: { name: 'Ashley Butler', userId: null } }))) {
    await prisma.player.create({
      data: { name: 'Ashley Butler', avatarColor: '#10b981', createdById: owner.id, claimToken: randomBytes(16).toString('base64url') },
    })
    console.log('  ✓ guest Ashley Butler')
  }

  console.log(`Done. Demo password: ${DEMO_PASSWORD}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
