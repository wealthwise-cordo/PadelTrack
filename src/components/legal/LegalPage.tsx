import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { LEGAL } from '@/lib/legal'

// Shared frame for the privacy notice and terms of use: readable
// on a phone, linked to each other, public (no sign-in needed).
export default function LegalPage({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-zinc-900 text-white">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center">
              <Trophy className="h-4 w-4 text-white" />
            </span>
            <span className="font-black text-lg tracking-tight">
              Padel<span className="text-orange-500">Track</span>
            </span>
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-zinc-500 mb-6">
          <Link href="/terms" className="hover:text-orange-600">Terms of Use</Link>
          <Link href="/privacy" className="hover:text-orange-600">Privacy Notice</Link>
        </nav>
        <h1 className="text-2xl font-black tracking-tight">{title}</h1>
        <p className="text-xs text-zinc-500 mt-1">Last updated {LEGAL.lastUpdated}</p>
        <p className="text-sm text-zinc-700 mt-4 leading-relaxed">{intro}</p>
        <div className="legal mt-6 space-y-6 text-sm text-zinc-700 leading-relaxed">{children}</div>
        <p className="text-xs text-zinc-500 mt-10 border-t border-zinc-100 pt-4">
          Questions? Email <a href={`mailto:${LEGAL.contactEmail}`} className="text-orange-600 underline">{LEGAL.contactEmail}</a>.
        </p>
      </main>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold text-zinc-900">{title}</h2>
      {children}
    </section>
  )
}

export function List({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc pl-5 space-y-1.5">{children}</ul>
}
