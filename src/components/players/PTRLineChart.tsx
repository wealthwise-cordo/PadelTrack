'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { PTRHistoryPoint } from '@/types'

interface Props {
  history: PTRHistoryPoint[]
  color: string
  startingPTR?: number
}

export default function PTRLineChart({ history, color, startingPTR = 1000 }: Props) {
  const data = [
    { match: 0, ptr: startingPTR, label: 'Start', isEvent: false },
    ...history.map((h, i) => ({
      match: i + 1,
      ptr: Math.round(h.ptrAfter),
      delta: h.delta,
      label: h.matchId ? `Match ${i + 1}` : 'Event',
      isEvent: !h.matchId,
    })),
  ]

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
        <XAxis
          dataKey="match"
          tick={{ fill: '#71717a', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          label={{ value: 'Matches', position: 'insideBottom', fill: '#a1a1aa', fontSize: 10 }}
        />
        <YAxis
          tick={{ fill: '#71717a', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          domain={['auto', 'auto']}
          width={45}
        />
        <Tooltip
          contentStyle={{
            background: '#ffffff',
            border: '1px solid #e4e4e7',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          labelStyle={{ color: '#52525b' }}
          itemStyle={{ color }}
          formatter={(value: number, _: string, item: { payload?: { delta?: number } }) => [
            `${value} ${item.payload?.delta !== undefined ? `(${item.payload.delta > 0 ? '+' : ''}${item.payload.delta.toFixed(1)})` : ''}`,
            'Rating',
          ]}
          labelFormatter={(v, payload) => payload?.[0]?.payload?.label ?? (v === 0 ? 'Start' : `Match ${v}`)}
        />
        <ReferenceLine y={startingPTR} stroke="#d4d4d8" strokeDasharray="4 4" />
        <Line
          type="monotone"
          dataKey="ptr"
          stroke={color}
          strokeWidth={2}
          dot={(props: { cx: number; cy: number; payload: { match: number; isEvent: boolean } }) => {
            const { cx, cy, payload } = props
            if (payload.isEvent) {
              return (
                <rect
                  key={`dot-${payload.match}`}
                  x={cx - 3.5}
                  y={cy - 3.5}
                  width={7}
                  height={7}
                  fill="#ffffff"
                  stroke={color}
                  strokeWidth={2}
                  transform={`rotate(45 ${cx} ${cy})`}
                />
              )
            }
            return <circle key={`dot-${payload.match}`} cx={cx} cy={cy} r={3} fill={color} />
          }}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
