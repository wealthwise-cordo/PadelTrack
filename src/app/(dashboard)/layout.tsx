import Navbar from '@/components/shared/Navbar'
import { getActiveSeason } from '@/lib/store'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const season = await getActiveSeason()

  return (
    <div className="min-h-screen">
      <Navbar seasonName={season?.name ?? null} />
      <main className="[padding-top:env(safe-area-inset-top)] md:pt-14 pb-20 md:pb-6 px-4 max-w-2xl mx-auto">
        {children}
      </main>
    </div>
  )
}
