import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/session'
import { getAccount } from '@/lib/store'
import { isAdminEmail } from '@/lib/analytics'
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle } from 'lucide-react'
import Link from 'next/link'
import { getAdminStats, parsePeriod, PERIODS, type KciStatus, type Period, type Indicator } from '@/lib/admin-stats'
import { WeeklyBars, MatchBars, WeeklyLine, CircleBars } from '@/components/admin/AdminCharts'

export const revalidate = 0

// Owner analytics. Only emails in ADMIN_EMAILS can open it; everyone else
// gets a 404 so the page isn't discoverable.
export default async function AdminPage({ searchParams }: { searchParams: { period?: string } }) {
  const session = await requireSession()
  const account = await getAccount(session.userId)
  if (!isAdminEmail(account?.email)) notFound()

  const period = parsePeriod(searchParams.period)
  const s = await getAdminStats(period)
  const span = period === 'all' ? 'all time' : period === '1w' ? 'last week' : `last ${PERIODS[period].label}`
  const per = { day: 'day', week: 'week', month: 'month' }[s.grain]
  const t = s.tiles
  const unlisted = s.venues.filter(v => !v.listed)
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–')
  const ratingChange = s.rating.now !== null && s.rating.then !== null ? s.rating.now - s.rating.then : null

  return (
    <div className="py-6 space-y-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Analytics</h1>
        <PeriodToggle current={period} />
        <p className="text-xs text-zinc-500 mt-2">
          Showing {span}; cards marked “now” or “all time” ignore the period. Charts by {per}{s.grain === 'week' ? ' starting Monday' : ''} (UTC).
          Sign-ins, active players, errors and deletions are recorded from 12 Oct 2026.
        </p>
      </div>

      <Section title="Key indicators" indicators={[]}>
        <div className="grid sm:grid-cols-3 gap-2">
          <Kci
            label="Ranked matches kept ranked"
            status={s.kci.rankedKept.status}
            value={s.kci.rankedKept.rate === null ? '–' : `${Math.round(s.kci.rankedKept.rate * 100)}%`}
            note={`${s.kci.rankedKept.kept} of ${s.kci.rankedKept.decided} decided${s.kci.rankedKept.pending ? ` · ${s.kci.rankedKept.pending} pending` : ''}`}
            bands={s.kci.rankedKept.bands}
          />
          <Kci
            label="New matches at unlisted venues"
            status={s.kci.unlistedVenues.status}
            value={s.kci.unlistedVenues.rate === null ? '–' : `${Math.round(s.kci.unlistedVenues.rate * 100)}%`}
            note={`${s.kci.unlistedVenues.unlisted} of ${s.kci.unlistedVenues.withVenue} matches with a venue`}
            bands={s.kci.unlistedVenues.bands}
          />
          <div className="glass rounded-xl p-3">
            <div className="text-[11px] font-semibold text-zinc-500">New registered players</div>
            <div className="text-2xl font-black tracking-tight mt-0.5">{s.kci.newPlayers.total}</div>
            <div className="mt-1.5 space-y-0.5 text-[11px] text-zinc-600">
              <div className="flex justify-between"><span>Signed up directly</span><span className="tabular-nums font-semibold">{s.kci.newPlayers.direct}</span></div>
              <div className="flex justify-between"><span>Joined after being added to a match</span><span className="tabular-nums font-semibold">{s.kci.newPlayers.viaMatch}</span></div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Adoption" indicators={[]}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Tile label="Registered players" value={t.registered} note={`${t.newInPeriod} new, ${span}`} />
          <Tile label="Active players" value={t.activeInPeriod} note={`${span} · ${t.active7d} in last 7 days`} />
          <Tile label="Matches recorded" value={t.matchesInPeriod} note={period === 'all' ? 'all time' : `${span} · ${t.matchesAllTime} all time`} />
          <Tile label="Guests claimed" value={pct(t.claimed, t.claimed + t.guests)} note={`${t.claimed} of ${t.claimed + t.guests} guests joined, all time`} />
        </div>
        <details className="glass rounded-xl group">
          <summary className="cursor-pointer list-none flex items-center justify-between px-4 py-3 text-sm font-semibold">
            <span>See who was active · {s.activePlayers.length}</span>
            <span className="text-xs text-zinc-500 group-open:hidden">Show</span>
            <span className="text-xs text-zinc-500 hidden group-open:inline">Hide</span>
          </summary>
          <div className="px-4 pb-4">
            <p className="text-[11px] text-zinc-500 mb-2">Players who opened the app, {span}. Admin only — not for sharing or export.</p>
            <Table
              empty="Nobody active in this period"
              head={['Player', 'Last active', 'Days', 'Matches']}
              rows={s.activePlayers.map(p => [
                <Link key="n" href={`/players/${p.id}`} className="hover:underline">{p.name}</Link>,
                p.lastActive,
                p.days,
                p.matches,
              ])}
            />
          </div>
        </details>
        <div className="grid sm:grid-cols-2 gap-3">
          <Card title="New sign-ups"><WeeklyBars data={s.signups} label="Sign-ups" /></Card>
          <Card title="Matches recorded"><MatchBars data={s.matchesRecorded} /></Card>
          <Card title="Active players" hint={`Players who opened the app that ${per}`}><WeeklyLine data={s.activeSeries} label="Active players" /></Card>
          <Card title="Sign-ins" hint="Sessions last weeks, so this undercounts use"><WeeklyLine data={s.signInSeries} label="Sign-ins" /></Card>
        </div>
      </Section>

      <Section title="Retention" indicators={s.sections.retention}>
        <Card title="Dormant players, now" hint="Joined 30+ days ago, no matches or visits in 30 days — most recently active first">
          <Table
            empty="No dormant players"
            head={['Player', 'Last match', 'Joined']}
            rows={s.dormant.map(d => [<Link key="n" href={`/players/${d.id}`} className="hover:underline">{d.name}</Link>, d.lastMatch, d.joined])}
          />
        </Card>
      </Section>

      <Section title="Match health" indicators={s.sections.matchHealth}>
        <Card
          title="Ranked matches turned friendly"
          hint="A guest didn’t join within 48 hours, so the match never counted towards ratings"
        >
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-black tracking-tight">{pct(s.converted.total, s.converted.rankedTotal)}</span>
            <span className="text-xs text-zinc-500">
              {s.converted.total} of {s.converted.rankedTotal} ranked matches, {span}{s.converted.pending ? ` · ${s.converted.pending} still waiting on confirmation or guests` : ''}
            </span>
          </div>
          <WeeklyBars data={s.converted.series} label="Turned friendly" ofKey="ranked" />
        </Card>
      </Section>

      <Section title="Rating integrity" indicators={s.sections.ratings}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Card
            title="Average rating, all registered players"
            hint={s.rating.now !== null
              ? `Now ${s.rating.now.toFixed(2)}${ratingChange !== null ? ` · ${ratingChange >= 0 ? '+' : ''}${ratingChange.toFixed(2)}${period === 'all' ? ' since launch' : ` over the ${span}`}` : ''}`
              : 'No rated players yet'}
          >
            <WeeklyLine data={s.rating.series} dataKey="level" label="Average level" decimals={2} padded />
          </Card>
          <Card title="Players by level, now" hint="Current level of every registered player">
            <CircleBars data={s.levels} label="Level" />
          </Card>
        </div>
      </Section>

      <Section title="Growth" indicators={s.sections.growth}>
        <Card title="Circle sizes, now" hint={`Registered players they've played a confirmed ranked match with · median ${s.circles.median}, mean ${s.circles.mean} across ${s.circles.players} players`}>
          <CircleBars data={s.circles.histogram} label="Circle of" />
        </Card>
      </Section>

      <Section title="Venues" indicators={[]}>
        <Card title="Venues not in the club list" hint={`Typed in via “My venue isn’t listed”, ${span} — candidates to add`}>
          <Table
            empty="No unlisted venues yet"
            head={['Venue', 'Matches', 'Last played']}
            rows={unlisted.map(v => [v.venue, v.matches, v.lastPlayed])}
          />
        </Card>
        <Card title="Matches by venue" hint={`${span.charAt(0).toUpperCase() + span.slice(1)}${s.noVenue ? ` · ${s.noVenue} matches with no location` : ''}`}>
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
      </Section>

      <Section title="Feature usage" indicators={s.sections.features} />

      <Section title="Reliability & running costs" indicators={s.sections.reliability}>
        <Card title="Errors" hint={`${s.errorCount}, ${span} · latest 50 shown · kept 90 days`}>
          {s.errors.length === 0 ? (
            <p className="text-sm text-zinc-500 py-4 text-center">No errors in this period</p>
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
      </Section>
    </div>
  )
}

// A titled group: its rated indicators first, then any charts and tables.
// The heading counts reds and ambers so problems show when skimming.
function Section({ title, indicators, children }: { title: string; indicators: Indicator[]; children?: React.ReactNode }) {
  const reds = indicators.filter(i => i.status === 'red').length
  const ambers = indicators.filter(i => i.status === 'amber').length
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">
        {title}
        {(reds > 0 || ambers > 0) && (
          <span className="normal-case tracking-normal font-semibold text-zinc-600 flex items-center gap-2">
            {reds > 0 && <span className="flex items-center gap-1"><XCircle className="h-3.5 w-3.5" style={{ color: STATUS.red.color }} aria-hidden />{reds} red</span>}
            {ambers > 0 && <span className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" style={{ color: STATUS.amber.color }} aria-hidden />{ambers} amber</span>}
          </span>
        )}
      </h2>
      {indicators.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-2">
          {indicators.map(i => <Kci key={i.label} {...i} />)}
        </div>
      )}
      {children}
    </section>
  )
}

// Links rather than a client toggle, so the period is in the URL and the
// page stays a plain server render.
function PeriodToggle({ current }: { current: Period }) {
  return (
    <nav className="mt-3 inline-flex rounded-xl bg-zinc-100 p-1 text-xs font-semibold" aria-label="Time period">
      {(Object.keys(PERIODS) as Period[]).map(p => (
        <Link
          key={p}
          href={`/admin?period=${p}`}
          aria-current={p === current ? 'page' : undefined}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${p === current ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
        >
          {PERIODS[p].label}
        </Link>
      ))}
    </nav>
  )
}

// Status is carried by icon + word as well as colour, never colour alone.
const STATUS: Record<KciStatus | 'info', { color: string; word: string; Icon: typeof CheckCircle2 }> = {
  green: { color: '#0ca30c', word: 'On track', Icon: CheckCircle2 },
  amber: { color: '#fab219', word: 'Watch', Icon: AlertTriangle },
  red: { color: '#d03b3b', word: 'Action needed', Icon: XCircle },
  none: { color: '#a1a1aa', word: 'No data yet', Icon: MinusCircle },
  info: { color: 'transparent', word: '', Icon: MinusCircle },
}

// `info` indicators are context only: no colour bar, no status.
function Kci({ label, status, value, note, bands }: { label: string; status: KciStatus | 'info'; value: string; note: string; bands?: string }) {
  const { color, word, Icon } = STATUS[status]
  return (
    <div className={`glass rounded-xl p-3 ${status === 'info' ? '' : 'border-l-4'}`} style={status === 'info' ? undefined : { borderLeftColor: color }}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold text-zinc-500">{label}</div>
        {status !== 'info' && (
          <div className="flex items-center gap-1 text-[11px] font-semibold text-zinc-700 shrink-0">
            <Icon className="h-3.5 w-3.5" style={{ color }} aria-hidden />
            {word}
          </div>
        )}
      </div>
      <div className="text-2xl font-black tracking-tight mt-0.5">{value}</div>
      <div className="text-[11px] text-zinc-600 mt-0.5">{note}</div>
      {bands && <div className="text-[10px] text-zinc-400 mt-1">{bands}</div>}
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
