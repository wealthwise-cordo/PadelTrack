'use client'

import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts'

interface Props {
  data: { ptrAfter: number; delta: number; isAdjustment?: boolean }[]
  color: string
  // How many of the most recent results to plot — zooming into just the
  // recent window (rather than the player's entire history) is what makes
  // a meaningful recent spike or dip actually visible, instead of getting
  // flattened out by the full PTR range.
  windowSize?: number
}

export default function SparklineChart({ data, color, windowSize = 3 }: Props) {
  // Form from matches only: a manual adjustment recalibrates the rating but
  // isn't movement, so the line is just the recent matches' changes.
  const recent = data.filter(d => !d.isAdjustment).slice(-windowSize)

  if (recent.length < 2) {
    return <div className="w-16 h-8 flex items-center justify-center text-xs text-muted-foreground">—</div>
  }

  let v = 0
  const chartData = recent.map(d => ({ v: (v += d.delta) }))

  return (
    <div className="w-16 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
