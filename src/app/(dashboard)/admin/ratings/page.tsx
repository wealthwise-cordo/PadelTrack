import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/session'
import { getRole, canAdjustRatings } from '@/lib/roles'
import { getAdjustmentLog, getCoolingOffPlayers, getLevellers, getPendingAdjustments, COOLING_OFF_DAYS } from '@/lib/rating-adjustments'
import AdjustmentReview from '@/components/admin/AdjustmentReview'
import LevellerManager from '@/components/admin/LevellerManager'
import { formatRating, formatRatingDelta } from '@/lib/utils'

export const revalidate = 0

const date = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' })

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-zinc-100 text-zinc-600',
}

// Rating adjustments. The super user reviews levellers' requests, appoints
// levellers and sees every reviewed adjustment; a leveller sees their own
// requests. Members get a 404. Adjustments are made from a player's profile.
export default async function RatingsAdminPage() {
  const session = await requireSession()
  const role = await getRole(session.userId)
  if (!canAdjustRatings(role)) notFound()
  const isSuper = role === 'superuser'

  const [pending, log, levellers, coolingOff] = await Promise.all([
    isSuper ? getPendingAdjustments() : [],
    getAdjustmentLog(isSuper ? {} : { requestedById: session.userId }),
    isSuper ? getLevellers() : [],
    getCoolingOffPlayers(),
  ])

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-zinc-500">
          Adjust a rating from the player’s profile — up to one level either way, with a reason.
          {isSuper ? ' Yours apply straight away; levellers’ wait for your review here.' : ' Each one goes to the super user for approval before it applies.'}
        </p>
      </div>

      {isSuper && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Waiting for review {pending.length > 0 && <span className="text-orange-600">({pending.length})</span>}</h2>
          {pending.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing to review.</p>
          ) : pending.map(a => (
            <div key={a.id} className="glass rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <Link href={`/players/${a.player.id}`} className="font-semibold hover:underline">{a.player.name}</Link>
                  <div className="text-[11px] text-zinc-500">From {a.requestedBy?.name ?? 'a former leveller'} · {date(a.createdAt)}</div>
                </div>
                <div className="text-right font-mono text-sm shrink-0">
                  <div className={a.delta > 0 ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}>{formatRatingDelta(a.delta)}</div>
                  <div className="text-[11px] text-zinc-500">{formatRating(a.player.ptr)} → {formatRating(a.player.ptr + a.delta)}</div>
                </div>
              </div>
              <p className="text-sm text-zinc-800 bg-zinc-50 rounded-lg px-3 py-2">{a.reason}</p>
              {Math.abs(a.player.ptr - a.ptrAtRequest) > 0.5 && (
                <p className="text-[11px] text-amber-700">Their rating has moved since this was requested (was {formatRating(a.ptrAtRequest)}). Approving applies the change to today’s rating.</p>
              )}
              <AdjustmentReview id={a.id} />
            </div>
          ))}
        </section>
      )}

      {coolingOff.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Cooling off</h2>
          <p className="text-[11px] text-zinc-500">Adjusted or rejected in the last {COOLING_OFF_DAYS} days, so they can’t be adjusted again yet.</p>
          <ul className="glass rounded-xl divide-y divide-zinc-100">
            {coolingOff.map(c => (
              <li key={c.player.id} className="p-3 flex items-center gap-3 text-sm">
                <Link href={`/players/${c.player.id}`} className="flex-1 min-w-0 font-medium hover:underline truncate">{c.player.name}</Link>
                <span className="text-[11px] text-zinc-500 shrink-0">Next from {date(c.until)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{isSuper ? 'History' : 'Your requests'}</h2>
        {log.length === 0 ? (
          <p className="text-sm text-zinc-500">No adjustments yet.</p>
        ) : (
          <ul className="glass rounded-xl divide-y divide-zinc-100">
            {log.map(a => (
              <li key={a.id} className="p-3 flex gap-3">
                <span className={`font-mono font-semibold text-sm w-14 shrink-0 ${a.delta > 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatRatingDelta(a.delta)}</span>
                <div className="flex-1 min-w-0 text-sm">
                  <div className="flex items-center gap-2">
                    <Link href={`/players/${a.player.id}`} className="font-medium hover:underline truncate">{a.player.name}</Link>
                    <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 ${STATUS_STYLE[a.status] ?? ''}`}>{a.status}</span>
                  </div>
                  <div className="text-zinc-700">{a.reason}</div>
                  {a.reviewNote && <div className="text-[11px] text-zinc-500 mt-0.5">Review note: {a.reviewNote}</div>}
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    {date(a.createdAt)}
                    {isSuper && <> · by {a.requestedBy?.name ?? 'unknown'}</>}
                    {a.reviewedBy && a.reviewedById !== a.requestedById && <> · reviewed by {a.reviewedBy.name}</>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isSuper && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Levellers</h2>
          <p className="text-[11px] text-zinc-500">Levellers can propose rating adjustments for your review. They don’t see analytics.</p>
          <div className="glass rounded-xl p-4">
            <LevellerManager levellers={levellers} />
          </div>
        </section>
      )}
    </div>
  )
}
