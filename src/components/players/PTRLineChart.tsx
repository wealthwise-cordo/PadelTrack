'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { levelFromInternal, levelDelta } from '@/lib/lta'
import { curveCardinal } from 'victory-vendor/d3-shape'

// Tension 0 is fully rounded, 1 is straight lines between matches.
const CURVE = curveCardinal.tension(0.5)

export interface RatingPoint {
  title: string // tooltip heading, e.g. "12 Oct 2026 · vs Cord & Ashley"
  rating: number
  delta?: number
  // A manual adjustment: drawn as a dotted step straight up or down from the
  // point before, not as a new point along the line.
  isAdjustment?: boolean
}

type Row = { i: number; rating: number | null; adj?: number; title: string; delta?: number; isAdjustment?: boolean }

interface Props {
  // Ratings and deltas on the engine's internal scale; plotted as LTA levels.
  points: RatingPoint[]
  color: string
}

export default function PTRLineChart({ points, color }: Props) {
  // Matches sit at even steps along x. An adjustment shares the x of the
  // point before it: the solid line breaks (a null row) and the `adj` series
  // draws the dotted vertical step, then the solid line carries on from the
  // new rating.
  const data: Row[] = []
  let x = -1
  for (const p of points) {
    const rating = Number(levelFromInternal(p.rating).toFixed(2))
    const delta = p.delta === undefined ? undefined : levelDelta(p.delta)
    const prev = data[data.length - 1]
    if (p.isAdjustment && prev) {
      prev.adj = prev.rating ?? prev.adj
      data.push({ i: x, rating: null, adj: prev.adj, title: '' })
      data.push({ i: x, rating, adj: rating, title: p.title, delta, isAdjustment: true })
    } else {
      x++
      data.push({ i: x, rating, title: p.title, delta })
    }
  }
  // Dashed guide at where this period started.
  const baseline = data[0]?.rating ?? undefined

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 8, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
        {/* Matches sit at even intervals; dates are in the tooltip, not the axis. */}
        <XAxis dataKey="i" type="number" domain={[0, Math.max(1, x)]} tick={false} tickLine={false} axisLine={false} height={4} />
        <YAxis
          tick={{ fill: '#71717a', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          domain={['auto', 'auto']}
          tickFormatter={(v: number) => v.toFixed(1)}
          width={36}
        />
        <Tooltip
          contentStyle={{ background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: '8px', fontSize: '12px' }}
          labelStyle={{ color: '#52525b' }}
          itemStyle={{ color }}
          formatter={(value: number, _: string, item: { payload?: Row }) => [
            `${value.toFixed(2)} ${item.payload?.delta !== undefined ? `(${item.payload.delta > 0 ? '+' : ''}${item.payload.delta.toFixed(2)})` : ''}`,
            item.payload?.isAdjustment ? 'Recalibrated' : 'Rating',
          ]}
          labelFormatter={(_: number, payload: { payload?: Row }[]) => payload?.[0]?.payload?.title ?? ''}
        />
        {baseline !== undefined && <ReferenceLine y={baseline} stroke="#d4d4d8" strokeDasharray="4 4" />}
        <Line
          type={CURVE}
          dataKey="rating"
          stroke={color}
          strokeWidth={2}
          dot={(props: { key?: string; cx?: number; cy?: number; payload?: Row }) =>
            props.payload?.isAdjustment || props.payload?.rating === null
              ? <g key={props.key} />
              : <circle key={props.key} cx={props.cx} cy={props.cy} r={3} fill={color} />}
          activeDot={{ r: 5, strokeWidth: 0 }}
          isAnimationActive={false}
        />
        <Line
          type="linear"
          dataKey="adj"
          stroke={color}
          strokeWidth={2}
          strokeDasharray="3 3"
          dot={false}
          activeDot={false}
          tooltipType="none"
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
