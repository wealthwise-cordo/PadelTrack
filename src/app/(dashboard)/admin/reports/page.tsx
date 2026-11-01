import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/session'
import { getRole } from '@/lib/roles'
import { getReports } from '@/lib/safety'
import { REPORT_REASONS, type ReportReason } from '@/lib/safety-reasons'
import ResolveReport from '@/components/admin/ResolveReport'

export const revalidate = 0

const when = (d: Date) => d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })

// Admin → Reports (super user): players reported by other players, oldest
// first. Act on it (rename, correct results, remove the account…), then mark
// it resolved with a note. Apple expects reports to be dealt with promptly.
export default async function AdminReportsPage() {
  const session = await requireSession()
  if ((await getRole(session.userId)) !== 'superuser') notFound()
  const { open, resolved } = await getReports()

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Open {open.length > 0 && <span className="text-orange-600">({open.length})</span>}</h3>
        {open.length === 0 ? (
          <p className="text-sm text-zinc-500">No reports waiting.</p>
        ) : (
          <ul className="space-y-3">
            {open.map(r => (
              <li key={r.id} className="glass rounded-xl p-4 space-y-3">
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    {r.player.deletedAt
                      ? <span className="font-semibold">{r.player.name} <span className="text-[11px] font-normal text-zinc-400">(account deleted)</span></span>
                      : <Link href={`/players/${r.player.id}`} className="font-semibold hover:underline">{r.player.name}</Link>}
                    <span className="text-[11px] text-zinc-400 shrink-0">{when(r.createdAt)}</span>
                  </div>
                  <div className="text-sm text-orange-700">{REPORT_REASONS[r.reason as ReportReason] ?? r.reason}</div>
                  {r.details && <p className="text-sm text-zinc-700 whitespace-pre-wrap">{r.details}</p>}
                  <div className="text-[11px] text-zinc-500">
                    Reported by {r.reporter.player ? <Link href={`/players/${r.reporter.player.id}`} className="hover:underline">{r.reporter.name}</Link> : r.reporter.name}
                    {!r.player.userId && ' · guest'}
                  </div>
                </div>
                <ResolveReport reportId={r.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {resolved.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Resolved</h3>
          <ul className="glass rounded-xl divide-y divide-zinc-100">
            {resolved.map(r => (
              <li key={r.id} className="px-4 py-3 text-sm space-y-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{r.player.name} · <span className="text-zinc-500">{REPORT_REASONS[r.reason as ReportReason] ?? r.reason}</span></span>
                  <span className="text-[11px] text-zinc-400 shrink-0">{r.resolvedAt && when(r.resolvedAt)}</span>
                </div>
                {r.resolution && <div className="text-xs text-zinc-600">{r.resolution}</div>}
                {r.resolvedBy && <div className="text-[11px] text-zinc-400">by {r.resolvedBy.name}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
