import { cn } from '@/lib/utils'

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
        isNeutral && 'text-muted-foreground bg-muted/30',
        isUp && 'text-neon-green bg-neon-green/10',
        !isUp && !isNeutral && 'text-red-400 bg-red-400/10',
        className
      )}
    >
      {isUp ? '▲' : isNeutral ? '—' : '▼'}
      {isNeutral ? '0' : `${Math.abs(delta).toFixed(1)}`}
    </span>
  )
}
