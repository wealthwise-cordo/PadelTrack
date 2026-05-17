import type { PTRCalculation } from '@/types'

interface Props {
  preview: PTRCalculation | null
  loading: boolean
}

export default function PTRPreview({ preview, loading }: Props) {
  if (loading) {
    return (
      <div className="glass rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-32 mb-3" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-16 bg-white/5 rounded-lg" />
          <div className="h-16 bg-white/5 rounded-lg" />
        </div>
      </div>
    )
  }

  if (!preview) return null

  return (
    <div className="glass rounded-xl p-4 border border-white/10">
      <h3 className="text-xs text-muted-foreground font-medium mb-3 uppercase tracking-wider">
        PTR Preview
      </h3>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-neon-green/5 border border-neon-green/20 rounded-lg p-3 text-center">
          <div className="text-xs text-muted-foreground mb-1">If Team A wins</div>
          <div className="text-neon-green font-mono font-bold text-lg">+{preview.deltaIfAWins}</div>
          <div className="text-red-400 font-mono text-sm">-{preview.deltaIfBWins}</div>
        </div>
        <div className="bg-blue-400/5 border border-blue-400/20 rounded-lg p-3 text-center">
          <div className="text-xs text-muted-foreground mb-1">If Team B wins</div>
          <div className="text-neon-green font-mono font-bold text-lg">+{preview.deltaIfBWins}</div>
          <div className="text-red-400 font-mono text-sm">-{preview.deltaIfAWins}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[10px] text-muted-foreground">Team A Expected</div>
          <div className="font-mono font-semibold text-sm">{preview.expectedWinProbA}%</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground">K-Factor</div>
          <div className="font-mono font-semibold text-sm">{preview.kFactor}</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground">Score Weight</div>
          <div className="font-mono font-semibold text-sm">{preview.scoreMultiplier.toFixed(2)}x</div>
        </div>
      </div>
    </div>
  )
}
