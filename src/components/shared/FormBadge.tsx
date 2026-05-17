interface Props {
  streak: number
  recentResults?: ('W' | 'L')[]
}

export default function FormBadge({ recentResults = [] }: Props) {
  return (
    <div className="flex items-center gap-0.5">
      {recentResults.slice(-5).map((r, i) => (
        <span
          key={i}
          className={`w-4 h-4 rounded-sm text-[9px] font-bold flex items-center justify-center ${
            r === 'W' ? 'bg-neon-green/20 text-neon-green' : 'bg-red-400/20 text-red-400'
          }`}
        >
          {r}
        </span>
      ))}
    </div>
  )
}
