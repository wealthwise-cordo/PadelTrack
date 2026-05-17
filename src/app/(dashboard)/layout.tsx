import Navbar from '@/components/shared/Navbar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-0 md:pt-14 pb-20 md:pb-6 px-4 max-w-2xl mx-auto">
        {children}
      </main>
    </div>
  )
}
