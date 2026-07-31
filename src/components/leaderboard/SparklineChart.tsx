'use client'

import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts'

interface Props {
  data: { ptrAfter: number }[]
  color: string
  // How many of the most recent results to plot — zooming into just the
  // recent window (rather than the player's entire history) is what makes
  // a meaningful recent spike or dip actually visible, instead of getting
  // flattened out by the full PTR range.
  windowSize?: number
}

export default function SparklineChart({ data, color, windowSize = 3 }: Props) {
  const recent = data.slice(-windowSize)

  if (recent.length < 2) {
    return <div className="w-16 h-8 flex items-center justify-center text-xs text-muted-foreground">—</div>
  }

  const chartData = recent.map(d => ({ v: d.ptrAfter }))

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
