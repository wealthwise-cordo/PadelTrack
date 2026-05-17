interface StatCard {
  label: string
  value: string | number
  sub?: string
  color?: string
}

interface Props {
  stats: StatCard[]
}

export default function StatCards({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map(({ label, value, sub, color }) => (
        <div key={label} className="glass rounded-xl p-3">
          <div className="text-xs text-muted-foreground mb-1">{label}</div>
          <div
            className="font-mono font-bold text-xl"
            style={color ? { color } : undefined}
          >
            {value}
          </div>
          {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
        </div>
      ))}
    </div>
  )
}
