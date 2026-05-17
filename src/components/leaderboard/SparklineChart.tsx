'use client'

import { LineChart, Line, ResponsiveContainer } from 'recharts'

interface Props {
  data: { ptrAfter: number }[]
  color: string
}

export default function SparklineChart({ data, color }: Props) {
  if (data.length < 2) {
    return <div className="w-16 h-8 flex items-center justify-center text-xs text-muted-foreground">—</div>
  }

  const chartData = data.map(d => ({ v: d.ptrAfter }))

  return (
    <div className="w-16 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
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
