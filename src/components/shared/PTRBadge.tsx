import { cn } from '@/lib/utils'
import { levelDelta } from '@/lib/lta'

interface Props {
  delta: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function PTRBadge({ delta, size = 'md', className }: Props) {
  const isUp = delta > 0
  const isNeutral = delta === 0

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 font-mono font-semibold rounded-md px-1.5',
        size === 'sm' && 'text-xs py-0.5',
        size === 'md' && 'text-sm py-1',
        size === 'lg' && 'text-base py-1.5',
        isNeutral && 'text-muted-foreground bg-muted',
        isUp && 'text-emerald-700 bg-emerald-50',
        !isUp && !isNeutral && 'text-red-600 bg-red-50',
        className
      )}
    >
      {isUp ? '▲' : isNeutral ? '—' : '▼'}
      {isNeutral ? '0.00' : `${Math.abs(levelDelta(delta)).toFixed(2)}`}
    </span>
  )
}
