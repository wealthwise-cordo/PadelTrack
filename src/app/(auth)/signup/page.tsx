import type { Metadata } from 'next'
import Link from 'next/link'
import { Trophy, ShieldCheck, Users, LayoutGrid, Swords, Flame, UserPlus, ClipboardCheck, TrendingUp, ArrowDown, Check } from 'lucide-react'
import SignUpForm from '@/components/shared/SignUpForm'
import Logo from '@/components/shared/Logo'
import { Court, Racket, Ball } from '@/components/marketing/PadelArt'

// The page to share when inviting people to PadelTrack: what it is, how it
// works, then the sign-up form. Sign-in (/login) and guest invite links
// (/claim/…) keep their plain screens.

const description = 'Record your padel matches, get a rating on the LTA 1.0–7.0 scale that moves with every result, and see where you rank among the people you actually play with. Free.'

export const metadata: Metadata = {
  title: 'Join PadelTrack · Padel rankings for you and your crew',
  description,
  openGraph: { title: 'Join PadelTrack', description, type: 'website' },
  twitter: { card: 'summary_large_image', title: 'Join PadelTrack', description },
}

const features = [
  {
    icon: TrendingUp,
    title: 'A rating that means something',
    body: 'One central home for your rating, wherever you play. Whichever club, court or group it’s with, every ranked match feeds the same rating on the LTA 1.0–7.0 scale — so there’s one place to see your true level.',
  },
  {
    icon: ShieldCheck,
    title: 'Results both sides agree on',
    body: 'Record the score and your opponents confirm it. No arguments, no made-up wins — and anything unconfirmed settles itself after 48 hours.',
  },
  {
    icon: Users,
    title: 'Your circle, your table',
    body: 'Everyone you play a ranked match with joins your rankings. See who’s top, who’s on a streak and who just pulled off an upset.',
  },
  {
    icon: LayoutGrid,
    title: 'Run the social nights',
    body: 'Americano, Round Robin, Snake and Ladders and leagues — PadelTrack draws the rounds and courts and keeps the scores.',
  },
  {
    icon: Swords,
    title: 'Head-to-heads',
    body: 'Your record against every opponent and alongside every partner. Finally settle who the better pairing is.',
  },
  {
    icon: Flame,
    title: 'Friendlies get remembered',
    body: 'Just knocking about? Save it as a friendly — it’s on your record without touching anyone’s rating.',
  },
]

const steps = [
  { icon: UserPlus, title: 'Sign up and pick your level', body: 'Choose the LTA statement that sounds like you — your rating starts there.' },
  { icon: ClipboardCheck, title: 'Record a match', body: 'Add your partner and opponents. Not on PadelTrack yet? Add them as a guest and send them an invite link.' },
  { icon: Trophy, title: 'Climb the rankings', body: 'Once it’s confirmed, ratings update and everyone in the match joins each other’s circle.' },
]

// Illustrative only: what the rankings screen looks like.
const sampleTable = [
  { name: 'Alex', rating: '4.62', color: '#0ea5e9', delta: '+0.08' },
  { name: 'You', rating: '4.41', color: '#f97316', delta: '+0.11', me: true },
  { name: 'Sam', rating: '4.27', color: '#8b5cf6', delta: '−0.05' },
  { name: 'Jordan', rating: '3.98', color: '#10b981', delta: '+0.03' },
]

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* Header */}
      <header className="bg-zinc-900 text-white">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-2">
          <Logo />
          <div className="flex-1" />
          <Link href="/login" className="text-sm font-semibold text-zinc-300 hover:text-white">Sign in</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-zinc-900 text-white">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-orange-500/20 blur-3xl" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto px-4 pt-10 pb-14 md:pt-16 md:pb-20 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-orange-300">
              <Ball className="h-3.5 w-3.5" /> Free · Built for padel
            </span>
            <h1 className="mt-4 text-4xl md:text-5xl font-black tracking-tight leading-[1.05]">
              Settle it on court.<br />
              <span className="text-orange-500">Prove it on the table.</span>
            </h1>
            <p className="mt-4 text-base md:text-lg text-zinc-300 max-w-md">
              Record your matches, get a padel rating that moves with every result, and see where you really rank among the people you play with.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a href="#join" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-orange-500 text-white hover:bg-orange-600 transition">
                Create your free account <ArrowDown className="h-4 w-4" />
              </a>
              <Link href="/login" className="px-5 py-3 rounded-xl font-semibold text-sm text-zinc-200 border border-white/15 hover:bg-white/5 transition">
                I have an account
              </Link>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-400">
              {['LTA 1.0–7.0 ratings', 'Opponent-confirmed scores', 'Completely free'].map(t => (
                <li key={t} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-orange-500" />{t}</li>
              ))}
            </ul>
          </div>

          {/* Court, racket and a sample rankings card */}
          <div className="relative mx-auto w-full max-w-md md:max-w-none">
            <Court className="w-full drop-shadow-2xl" />
            <Racket className="absolute -top-8 -right-2 h-32 md:h-40 rotate-[24deg] drop-shadow-xl" />
            <div className="absolute -bottom-8 left-2 md:-left-6 w-56 rounded-2xl bg-white text-zinc-900 shadow-2xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black uppercase tracking-wider">Your circle</span>
                <span className="text-[10px] text-zinc-400">Rating</span>
              </div>
              <ol className="space-y-1.5">
                {sampleTable.map((p, i) => (
                  <li key={p.name} className={`flex items-center gap-2 rounded-lg px-1.5 py-1 ${p.me ? 'bg-orange-50' : ''}`}>
                    <span className="w-3 text-[10px] font-bold text-zinc-400">{i + 1}</span>
                    <span className="h-5 w-5 rounded-full text-[9px] font-bold text-white flex items-center justify-center" style={{ backgroundColor: p.color }}>{p.name[0]}</span>
                    <span className={`flex-1 text-xs ${p.me ? 'font-bold' : 'font-medium'}`}>{p.name}</span>
                    <span className="font-mono text-xs font-bold">{p.rating}</span>
                    <span className={`w-9 text-right font-mono text-[10px] ${p.delta.startsWith('+') ? 'text-emerald-600' : 'text-red-500'}`}>{p.delta}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 pt-20 pb-14">
        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-center">Everything your padel group argues about, sorted</h2>
        <p className="mt-2 text-sm md:text-base text-zinc-500 text-center max-w-xl mx-auto">
          Made for the regular Tuesday-night four, the club ladder, and everyone in between.
        </p>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-zinc-200 p-5 hover:border-orange-300 hover:shadow-sm transition">
              <span className="h-10 w-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-bold">{title}</h3>
              <p className="mt-1 text-sm text-zinc-600 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-zinc-50 border-y border-zinc-200">
        <div className="max-w-6xl mx-auto px-4 py-14">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-center">How it works</h2>
          <ol className="mt-10 grid md:grid-cols-3 gap-6">
            {steps.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="relative rounded-2xl bg-white border border-zinc-200 p-5">
                <span className="absolute -top-3 left-5 h-6 px-2 rounded-full bg-zinc-900 text-white text-[11px] font-black flex items-center">STEP {i + 1}</span>
                <Icon className="h-6 w-6 text-orange-500 mt-2" />
                <h3 className="mt-2 font-bold">{title}</h3>
                <p className="mt-1 text-sm text-zinc-600 leading-relaxed">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Sign-up */}
      <section id="join" className="scroll-mt-4 max-w-6xl mx-auto px-4 py-14 grid md:grid-cols-[1fr_minmax(0,24rem)] gap-10 md:gap-16 items-start">
        <div className="md:sticky md:top-8">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight">Get on the table</h2>
          <p className="mt-2 text-zinc-600 max-w-md">
            It takes a minute. Pick the level that sounds most like you — if you already have a rating on Playtomic or similar, use that.
          </p>
          <div className="hidden md:flex items-end gap-4 mt-8">
            <Racket className="h-44 -rotate-12" />
            <Ball className="h-10 mb-4" />
          </div>
        </div>
        <div className="w-full">
          <SignUpForm
            collectProfile
            heading="Create your account"
            footer={
              <p className="text-sm text-muted-foreground text-center mt-6">
                Already have an account?{' '}
                <Link href="/login" className="font-semibold text-orange-600 hover:underline">Sign in</Link>
              </p>
            }
          />
        </div>
      </section>

      <footer className="flex justify-center gap-4 pb-8 text-[11px] text-zinc-400">
        <Link href="/terms" className="hover:text-zinc-700">Terms of Use</Link>
        <Link href="/privacy" className="hover:text-zinc-700">Privacy</Link>
      </footer>
    </div>
  )
}
