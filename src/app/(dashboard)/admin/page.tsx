import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/session'
import { getAccount } from '@/lib/store'
import { isAdminEmail } from '@/lib/analytics'
import { getAdminStats } from '@/lib/admin-stats'
import { WeeklyBars, MatchBars, WeeklyLine, CircleBars } from '@/components/admin/AdminCharts'

export const revalidate = 0

// Owner analytics. Only emails in ADMIN_EMAILS can open it; everyone else
// gets a 404 so the page isn't discoverable.
export default async function AdminPage() {
  const session = await requireSession()
  const account = await getAccount(session.userId)
  if (!isAdminEmail(account?.email)) notFound()

  const s = await getAdminStats()
  const t = s.tiles
  const unlisted = s.venues.filter(v => !v.listed)
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–')
  const ratingChange = s.rating.now !== null && s.rating.then !== null ? s.rating.now - s.rating.then : null

  return (
    <div className="py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Analytics</h1>
        <p className="text-xs text-zinc-500 mt-1">Last 12 weeks, by week starting Monday (UTC). Sign-ins, active users and errors are recorded from 12 Oct 2026.</p>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Tile label="Registered players" value={t.registered} note={`${t.newThisWeek} new this week`} />
        <Tile label="Active last 7 days" value={t.active7d} note={`${t.active30d} in last 30 days`} />
        <Tile label="Matches" value={t.matches} note={`${t.matches7d} in last 7 days`} />
        <Tile label="Guests claimed" value={pct(t.claimed, t.claimed + t.guests)} note={`${t.claimed} of ${t.claimed + t.guests} guests joined`} />
      </section>

      <div className="grid sm:grid-cols-2 gap-3">
        <Card title="New sign-ups"><WeeklyBars data={s.signupsByWeek} label="Sign-ups" /></Card>
        <Card title="Matches recorded"><MatchBars data={s.matchesByWeek} /></Card>
        <Card title="Weekly active players" hint="Players who opened the app that week"><WeeklyLine data={s.activeByWeek} label="Active players" /></Card>
        <Card title="Sign-ins" hint="Sessions last weeks, so this undercounts use"><WeeklyLine data={s.signInsByWeek} label="Sign-ins" /></Card>
      </div>

      <Card
        title="Ranked matches turned friendly"
        hint="A guest didn’t join within 48 hours, so the match never counted towards ratings"
      >
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-2xl font-black tracking-tight">{pct(s.converted.total, s.converted.rankedTotal)}</span>
          <span className="text-xs text-zinc-500">
            {s.converted.total} of {s.converted.rankedTotal} ranked matches, all time{s.converted.stillPending ? ` · ${s.converted.stillPending} still waiting on confirmation or guests` : ''}
          </span>
        </div>
        <WeeklyBars data={s.converted.byWeek} label="Turned friendly" ofKey="ranked" />
      </Card>

      <Card
        title="Average rating, all registered players"
        hint={s.rating.now !== null
          ? `Now ${s.rating.now.toFixed(2)}${ratingChange !== null ? ` · ${ratingChange >= 0 ? '+' : ''}${ratingChange.toFixed(2)} over 12 weeks` : ''}`
          : 'No rated players yet'}
      >
        <WeeklyLine data={s.rating.byWeek} dataKey="level" label="Average level" decimals={2} padded />
      </Card>

      <Card title="Circle sizes" hint={`Registered players they've played a confirmed ranked match with · median ${s.circles.median}, mean ${s.circles.mean} across ${s.circles.players} players`}>
        <CircleBars data={s.circles.histogram} />
      </Card>

      <Card title="Venues not in the club list" hint="Typed in via “My venue isn’t listed” — candidates to add">
        <Table
          empty="No unlisted venues yet"
          head={['Venue', 'Matches', 'Last played']}
          rows={unlisted.map(v => [v.venue, v.matches, v.lastPlayed])}
        />
      </Card>

      <Card title="Matches by venue" hint={`All time${s.noVenue ? ` · ${s.noVenue} matches with no location` : ''}`}>
        <Table
          empty="No matches with a location yet"
          head={['Venue', 'Matches', 'Last played']}
          rows={s.venues.slice(0, 25).map(v => [
            <span key="v">{v.venue}{!v.listed && <span className="ml-1.5 text-[10px] font-semibold text-zinc-500 border border-zinc-200 rounded px-1">unlisted</span>}</span>,
            v.matches,
            v.lastPlayed,
          ])}
        />
      </Card>

      <Card title="Errors" hint={`${t.errors7d} in the last 7 days · latest 50 shown · kept 90 days`}>
        {s.errors.length === 0 ? (
          <p className="text-sm text-zinc-500 py-4 text-center">No errors logged</p>
        ) : (
          <div className="divide-y divide-zinc-100 -mx-1">
            {s.errors.map(e => (
              <details key={e.id} className="px-1 py-2 group">
                <summary className="cursor-pointer list-none flex items-start gap-2 text-sm">
                  <span className={`shrink-0 mt-0.5 text-[10px] font-semibold uppercase rounded px-1 border ${e.source === 'server' ? 'border-zinc-300 text-zinc-600' : 'border-zinc-200 text-zinc-500'}`}>{e.source}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate group-open:whitespace-normal">{e.message}</span>
                    <span className="block text-[11px] text-zinc-400">{new Date(e.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}{e.path ? ` · ${e.path}` : ''}</span>
                  </span>
                </summary>
                {e.stack && <pre className="mt-2 text-[11px] leading-snug text-zinc-600 bg-zinc-50 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-words">{e.stack}</pre>}
              </details>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function Tile({ label, value, note }: { label: string; value: number | string; note: string }) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="text-[11px] font-semibold text-zinc-500">{label}</div>
      <div className="text-2xl font-black tracking-tight mt-0.5">{value}</div>
      <div className="text-[11px] text-zinc-500 mt-0.5">{note}</div>
    </div>
  )
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-xl p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <p className="text-[11px] text-zinc-500 mt-0.5 mb-3">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </section>
  )
}

function Table({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-zinc-500 py-4 text-center">{empty}</p>
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] text-zinc-500 text-left">
            {head.map((h, i) => <th key={h} className={`font-semibold px-1 pb-1.5 ${i > 0 ? 'text-right whitespace-nowrap' : ''}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => <td key={j} className={`px-1 py-1.5 ${j > 0 ? 'text-right tabular-nums whitespace-nowrap text-zinc-600' : ''}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
