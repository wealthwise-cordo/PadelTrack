import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { Lock } from 'lucide-react'
import Navbar from '@/components/shared/Navbar'
import { getActiveSeason, listSeasons } from '@/lib/store'
import { getViewedSeason, VIEW_SEASON_COOKIE } from '@/lib/view-season'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [viewed, active, seasons] = await Promise.all([getViewedSeason(), getActiveSeason(), listSeasons()])
  const viewingPast = !!viewed && viewed.status !== 'active'

  return (
    <div className="min-h-screen">
      <Navbar
        seasons={seasons.map(s => ({ id: s.id, name: s.name, location: s.location, status: s.status }))}
        viewedSeason={viewed ? { id: viewed.id, name: viewed.name, location: viewed.location, status: viewed.status } : null}
        activeSeasonId={active?.id ?? null}
      />
      <main className="[padding-top:env(safe-area-inset-top)] md:pt-14 pb-20 md:pb-6 px-4 max-w-2xl mx-auto">
        {viewingPast && (
          <div className="mt-4 glass rounded-xl px-3 py-2 flex items-center gap-2 text-xs">
            <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="flex-1 text-muted-foreground">
              Viewing <span className="font-semibold text-foreground">{viewed!.name}</span> — closed, read-only
            </span>
            {active && <BackToLive activeName={active.name} />}
          </div>
        )}
        {children}
      </main>
    </div>
  )
}

function BackToLive({ activeName }: { activeName: string }) {
  return (
    <form action={clearViewedSeason}>
      <button type="submit" className="font-bold text-neon-green hover:underline">
        Back to {activeName}
      </button>
    </form>
  )
}

async function clearViewedSeason() {
  'use server'
  cookies().delete(VIEW_SEASON_COOKIE)
  revalidatePath('/', 'layout')
}
