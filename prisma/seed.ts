import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const COLORS = ['#00ff87', '#00d4ff', '#a855f7', '#ff6b35', '#fbbf24', '#f472b6', '#34d399', '#60a5fa']

const PLAYERS = [
  { name: 'Cord van Eck',   nickname: 'Green Mamba' },
  { name: 'JonJon Clark',   nickname: 'Double J'    },
  { name: 'Zac Schmidt',    nickname: 'The Hammer'  },
  { name: 'Brandon Fair',   nickname: 'Fairway'     },
  { name: 'Cameron Meek',   nickname: 'Cam Bam'     },
  { name: 'Ashley Butler',  nickname: 'Red Mist'    },
  { name: 'Alex Messeguer', nickname: 'The Tornado' },
  { name: 'Jason Knibbs',   nickname: 'Knibster'    },
]

async function main() {
  console.log('Seeding database…')
  const password = await bcrypt.hash('password123', 10)

  for (let i = 0; i < PLAYERS.length; i++) {
    const { name, nickname } = PLAYERS[i]
    const email = name.toLowerCase().replace(/ /g, '.') + '@ptr.com'

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, password, name },
    })

    await prisma.player.upsert({
      where: { userId: user.id },
      update: {},
      create: { name, nickname, avatarColor: COLORS[i], userId: user.id },
    })

    console.log(`  ✓ ${name}`)
  }

  console.log('Done. Login: <name>@ptr.com / password123')
}

main().catch(console.error).finally(() => prisma.$disconnect())
