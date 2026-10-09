// Single-elimination "One Point" knockout for exactly 8 players, seeded so
// the top 4 by PTR can only meet in later rounds:
//   - Seed 1 sits at the top of the draw, seed 2 at the bottom — they can
//     only meet in the final.
//   - Seed 3 sits in the bottom half (seed 2's side), seed 4 in the top
//     half (seed 1's side) — each can only meet its half's top seed in the
//     semifinal.
//   - The remaining 4 players are randomly assigned, one per seed, so
//     every first-round match pairs a seed against a random opponent.

export interface OnePointFixture {
  round: number
  position: number
  sequence: number
  player1Id: string | null
  player2Id: string | null
}

// Bracket slots are 1-8; slot pairs (1,2) (3,4) (5,6) (7,8) are the four
// first-round (quarterfinal) matches. Seed -> fixed slot; the remaining
// slots are filled with the shuffled unseeded players.
const SEED_SLOT: Record<number, number> = { 1: 1, 2: 8, 3: 5, 4: 4 }
const RANDOM_SLOTS = [2, 3, 6, 7]

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// `playerIdsByPtrDesc` must be exactly 8 ids, highest PTR first. Returns
// the 8 ids in bracket slot order (index 0 = slot 1, ... index 7 = slot 8).
export function seedBracket(playerIdsByPtrDesc: string[]): string[] {
  if (playerIdsByPtrDesc.length !== 8) throw new Error('One Point requires exactly 8 players')

  const slots = new Array<string>(8)
  const seeds = playerIdsByPtrDesc.slice(0, 4)
  const rest = shuffled(playerIdsByPtrDesc.slice(4))

  seeds.forEach((id, i) => {
    slots[SEED_SLOT[i + 1] - 1] = id
  })
  RANDOM_SLOTS.forEach((slot, i) => {
    slots[slot - 1] = rest[i]
  })

  return slots
}

// Builds the 7 fixtures (4 quarterfinals + 2 semifinals + 1 final) for a
// bracket-ordered roster of 8. Quarterfinal players are known immediately;
// semifinal/final players start null and are filled in as earlier matches
// complete. `sequence` reflects play order — all four quarterfinals top
// to bottom, then both semifinals, then the final.
export function buildFixtures(bracket: string[]): OnePointFixture[] {
  return [
    { round: 1, position: 1, sequence: 1, player1Id: bracket[0], player2Id: bracket[1] },
    { round: 1, position: 2, sequence: 2, player1Id: bracket[2], player2Id: bracket[3] },
    { round: 1, position: 3, sequence: 3, player1Id: bracket[4], player2Id: bracket[5] },
    { round: 1, position: 4, sequence: 4, player1Id: bracket[6], player2Id: bracket[7] },
    { round: 2, position: 1, sequence: 5, player1Id: null, player2Id: null },
    { round: 2, position: 2, sequence: 6, player1Id: null, player2Id: null },
    { round: 3, position: 1, sequence: 7, player1Id: null, player2Id: null },
  ]
}

export const ONE_POINT_ROUND_NAMES: Record<number, string> = {
  1: 'Quarterfinal',
  2: 'Semifinal',
  3: 'Final',
}
