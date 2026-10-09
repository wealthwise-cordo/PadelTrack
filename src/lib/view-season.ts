import { cookies } from 'next/headers'
import type { Season } from '@prisma/client'
import { getActiveSeason, getSeason } from '@/lib/store'

// Which season this viewer is looking at. Purely a per-browser view
// preference set by the navbar season switcher — it never changes which
// season is active, and every write path still targets the active season.
export const VIEW_SEASON_COOKIE = 'viewSeasonId'

export async function getViewedSeason(): Promise<Season | null> {
  const id = cookies().get(VIEW_SEASON_COOKIE)?.value
  if (id) {
    const season = await getSeason(id)
    if (season) return season
  }
  return getActiveSeason()
}
