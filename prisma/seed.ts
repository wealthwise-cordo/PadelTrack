import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const PLAYER_COLORS = [
  '#00ff87', '#00d4ff', '#a855f7', '#ff6b35',
  '#fbbf24', '#f472b6', '#34d399', '#60a5fa',
]

const players = [
  { name: 'Alex Torres', nickname: 'El Toro' },
  { name: 'Marco Reyes', nickname: 'The Wall' },
  { name: 'Luis Mendez', nickname: 'Flash' },
  { name: 'Carlos Ruiz', nickname: 'El Jefe' },
  { name: 'Diego Morales', nickname: 'Dagger' },
  { name: 'Pablo Santos', nickname: 'Pablito' },
  { name: 'Javier Vega', nickname: 'Jaguar' },
  { name: 'Roberto Cruz', nickname: 'Cobra' },
]

async function main() {
  console.log('Seeding database...')

  // Create players with users
  const createdPlayers = []
  for (let i = 0; i < players.length; i++) {
    const p = players[i]
    const email = `${p.name.toLowerCase().replace(' ', '.')}@ptr.com`
    const password = await bcrypt.hash('password123', 10)

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, password, name: p.name },
    })

    const player = await prisma.player.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        name: p.name,
        nickname: p.nickname,
        avatarColor: PLAYER_COLORS[i],
        userId: user.id,
      },
    })

    createdPlayers.push(player)
    console.log(`Created player: ${p.name}`)
  }

  console.log('Seed complete! All 8 players created.')
  console.log('Login with any player email (e.g. alex.torres@ptr.com) and password: password123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
