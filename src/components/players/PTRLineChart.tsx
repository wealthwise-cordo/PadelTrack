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
    { match: 0, ptr: startingPTR, label: 'Start' },
    ...history.map((h, i) => ({
      match: i + 1,
      ptr: Math.round(h.ptrAfter),
      delta: h.delta,
      label: `Match ${i + 1}`,
    })),
  ]

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="match"
          tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          label={{ value: 'Matches', position: 'insideBottom', fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
        />
        <YAxis
          tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          domain={['auto', 'auto']}
          width={45}
        />
        <Tooltip
          contentStyle={{
            background: 'rgba(10,15,30,0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
          itemStyle={{ color }}
          formatter={(value: number, _: string, props: { payload: { delta: number } }) => [
            `${value} PTR ${props.payload.delta !== undefined ? `(${props.payload.delta > 0 ? '+' : ''}${props.payload.delta?.toFixed(1)})` : ''}`,
            'PTR',
          ]}
          labelFormatter={(v) => v === 0 ? 'Start' : `Match ${v}`}
        />
        <ReferenceLine y={startingPTR} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
        <Line
          type="monotone"
          dataKey="ptr"
          stroke={color}
          strokeWidth={2}
          dot={{ fill: color, strokeWidth: 0, r: 3 }}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
