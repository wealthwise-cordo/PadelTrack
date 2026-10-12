import Link from 'next/link'
import Logo from '@/components/shared/Logo'

// Shared frame for the signed-out screens (login, sign up, claim).
export default function AuthShell({ subtitle, children }: { subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="bg-zinc-900 text-white">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-2">
          <Logo />
        </div>
      </header>
      <div className="flex-1 flex items-start sm:items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          {subtitle && <p className="text-sm text-muted-foreground text-center mb-6">{subtitle}</p>}
          {children}
        </div>
      </div>
      <footer className="flex justify-center gap-4 pb-6 text-[11px] text-zinc-400">
        <Link href="/terms" className="hover:text-zinc-700">Terms of Use</Link>
        <Link href="/privacy" className="hover:text-zinc-700">Privacy</Link>
      </footer>
    </div>
  )
}

export const inputClass =
  'w-full bg-white border border-zinc-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition'
export const primaryButtonClass =
  'w-full py-3 rounded-xl font-bold text-sm bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition'
