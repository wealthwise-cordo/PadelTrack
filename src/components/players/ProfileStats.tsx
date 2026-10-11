'use client'

import { useMemo, useState } from 'react'
import { TrendingUp, Target, Zap, Trophy, Swords, Activity } from 'lucide-react'
import PTRLineChart, { type RatingPoint } from '@/components/players/PTRLineChart'
import { getWinRate, formatRatingDelta } from '@/lib/utils'
import type { ProfileMatch } from '@/types'

type Range = 'last5' | 'last10' | 'ytd' | 'all'

const RANGES: { key: Range; label: string }[] = [
  { key: 'last5', label: 'Last 5' },
  { key: 'last10', label: 'Last 10' },
  { key: 'ytd', label: 'Year to date' },
  { key: 'all', label: 'All time' },
]

const TZ = 'Europe/London'
const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ })
const yearOf = (d: Date) => Number(d.toLocaleDateString('en-GB', { year: 'numeric', timeZone: TZ }))

// The rating chart and stat tiles for a profile, filtered by the chosen time
// range. `matches` are this player's confirmed matches, oldest first.
export default function ProfileStats({ matches, currentRating }: { matches: ProfileMatch[]; currentRating: number }) {
  const [range, setRange] = useState<Range>('all')

  const inRange = useMemo(() => {
    if (range === 'last5') return matches.slice(-5)
    if (range === 'last10') return matches.slice(-10)
    if (range === 'ytd') {
      const year = yearOf(new Date())
      return matches.filter(m => yearOf(new Date(m.playedAt)) === year)
    }
    return matches
  }, [matches, range])

  // Every range includes the most recent match, so the line ends at the
  // current rating and is walked backwards through each match's change.
  const points = useMemo<RatingPoint[]>(() => {
    if (inRange.length === 0) return []
    const net = inRange.reduce((s, m) => s + m.delta, 0)
    let rating = currentRating - net
    const out: RatingPoint[] = [{
      title: range === 'all' ? 'Starting rating' : `Before ${longDate(inRange[0].playedAt)}`,
      rating,
    }]
    for (const m of inRange) {
      rating += m.delta
      out.push({ title: `${longDate(m.playedAt)} · ${m.won ? 'beat' : 'lost to'} ${m.opponents}`, rating, delta: m.delta })
    }
    return out
  }, [inRange, currentRating, range])

  const wins = inRange.filter(m => m.won).length
  const losses = inRange.length - wins
  const net = inRange.reduce((s, m) => s + m.delta, 0)
  const gains = inRange.filter(m => m.delta > 0)
  const drops = inRange.filter(m => m.delta < 0)
  const avgGain = gains.length ? gains.reduce((s, m) => s + m.delta, 0) / gains.length : 0
  const avgDrop = drops.length ? Math.abs(drops.reduce((s, m) => s + m.delta, 0) / drops.length) : 0
  let bestStreak = 0
  let run = 0
  for (const m of inRange) {
    run = m.won ? run + 1 : 0
    bestStreak = Math.max(bestStreak, run)
  }
  const sum = (k: 'setsFor' | 'setsAgainst' | 'gamesFor' | 'gamesAgainst') => inRange.reduce((s, m) => s + m[k], 0)

  // Top row: results. Bottom row: form and rating movement.
  const tiles = [
    { label: 'Win rate', value: `${getWinRate(wins, inRange.length)}%`, icon: Target },
    { label: 'Record', value: `${wins}W–${losses}L`, icon: Swords },
    { label: 'Sets', value: `${sum('setsFor')}–${sum('setsAgainst')}`, icon: Target },
    { label: 'Games', value: `${sum('gamesFor')}–${sum('gamesAgainst')}`, icon: Zap },
    { label: 'Best streak', value: `${bestStreak}W`, icon: Zap },
    { label: 'Rating change', value: formatRatingDelta(net), icon: Activity, tone: net > 0 ? 'text-emerald-700' : net < 0 ? 'text-red-600' : '' },
    { label: 'Avg gain / win', value: formatRatingDelta(avgGain), icon: TrendingUp },
    { label: 'Avg loss / defeat', value: formatRatingDelta(-avgDrop), icon: Trophy },
  ]

  return (
    <div className="space-y-3">
      <div className="glass rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-orange-500" />
            Rating history
          </h2>
          <div className="flex rounded-lg bg-zinc-100 p-0.5" role="tablist" aria-label="Time range">
            {RANGES.map(r => (
              <button
                key={r.key}
                role="tab"
                aria-selected={range === r.key}
                onClick={() => setRange(r.key)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition ${
                  range === r.key ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {points.length > 0 ? (
          <PTRLineChart points={points} color="#f97316" />
        ) : (
          <div className="h-[200px] flex items-center justify-center text-sm text-zinc-400">
            {matches.length === 0 ? 'No ranked matches yet' : 'No ranked matches in this period'}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="glass rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mb-1">
              <Icon className="h-3 w-3" /> {label}
            </div>
            <div className={`font-mono font-bold text-lg ${tone ?? ''}`}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
