'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { curveCardinal } from 'victory-vendor/d3-shape'

// Tension 0 is fully rounded, 1 is straight lines between matches.
const CURVE = curveCardinal.tension(0.5)

export interface RatingPoint {
  title: string // tooltip heading, e.g. "12 Oct 2026 · vs Cord & Ashley"
  rating: number
  delta?: number
}

interface Props {
  points: RatingPoint[]
  color: string
  baseline?: number
}

export default function PTRLineChart({ points, color, baseline = 1000 }: Props) {
  const data = points.map((p, i) => ({ ...p, i, rating: Math.round(p.rating) }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 8, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
        {/* Matches sit at even intervals; dates are in the tooltip, not the axis. */}
        <XAxis dataKey="i" type="number" domain={[0, Math.max(1, data.length - 1)]} tick={false} tickLine={false} axisLine={false} height={4} />
        <YAxis
          tick={{ fill: '#71717a', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          domain={['auto', 'auto']}
          width={45}
        />
        <Tooltip
          contentStyle={{ background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: '8px', fontSize: '12px' }}
          labelStyle={{ color: '#52525b' }}
          itemStyle={{ color }}
          formatter={(value: number, _: string, item: { payload?: { delta?: number } }) => [
            `${value} ${item.payload?.delta !== undefined ? `(${item.payload.delta > 0 ? '+' : ''}${item.payload.delta.toFixed(1)})` : ''}`,
            'Rating',
          ]}
          labelFormatter={(i: number) => data[i]?.title ?? ''}
        />
        <ReferenceLine y={baseline} stroke="#d4d4d8" strokeDasharray="4 4" />
        <Line
          type={CURVE}
          dataKey="rating"
          stroke={color}
          strokeWidth={2}
          dot={{ r: 3, fill: color, strokeWidth: 0 }}
          activeDot={{ r: 5, strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
