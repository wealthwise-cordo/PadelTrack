'use client'

import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// Chart styling for the admin page: one hue per measure (palette slot 2,
// orange, near the brand colour); blue (slot 1) only when a chart has a
// second series. Hairline solid grid, 2px lines, ≤24px bars with a 4px
// rounded end, 2px surface gap between stacked segments.
const ORANGE = '#eb6834'
const BLUE = '#2a78d6'
const SURFACE = '#ffffff'
const GRID = '#e4e4e7'
const INK_MUTED = '#71717a'

const axis = { tick: { fill: INK_MUTED, fontSize: 10 }, tickLine: false, axisLine: false } as const
const tooltip = {
  contentStyle: { background: SURFACE, border: `1px solid ${GRID}`, borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#52525b' },
  itemStyle: { color: '#18181b' },
  cursor: { fill: 'rgba(24,24,27,0.04)' },
}

type Row = Record<string, string | number | null>

// `ofKey` names a field shown as "n of total" in the tooltip.
export function WeeklyBars({ data, label, ofKey, height = 160 }: { data: Row[]; label: string; ofKey?: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={16} />
        <YAxis {...axis} allowDecimals={false} width={36} />
        <Tooltip {...tooltip} formatter={(v: number, _n: string, item: { payload?: Row }) => [
          ofKey && item.payload ? `${v ?? 0} of ${item.payload[ofKey] ?? 0}` : v ?? 0,
          label,
        ]} />
        <Bar dataKey="count" fill={ORANGE} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// Ranked + friendly stacked; legend above because there are two series.
export function MatchBars({ data }: { data: Row[] }) {
  return (
    <div>
      <div className="flex gap-4 text-[11px] text-zinc-600 mb-1">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: ORANGE }} />Ranked</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: BLUE }} />Friendly</span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={16} />
          <YAxis {...axis} allowDecimals={false} width={36} />
          <Tooltip {...tooltip} formatter={(v: number, name: string) => [v ?? 0, name === 'ranked' ? 'Ranked' : 'Friendly']} />
          <Bar dataKey="ranked" stackId="m" fill={ORANGE} stroke={SURFACE} strokeWidth={2} maxBarSize={24} isAnimationActive={false} />
          <Bar dataKey="friendly" stackId="m" fill={BLUE} stroke={SURFACE} strokeWidth={2} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Weeks before tracking began are null, so the line starts where data does.
// `padded` fits the axis to the data with a quarter-level margin (for
// ratings); otherwise the axis starts at zero (for counts).
export function WeeklyLine({ data, dataKey = 'count', label, decimals = 0, padded = false }: { data: Row[]; dataKey?: string; label: string; decimals?: number; padded?: boolean }) {
  let domain: [number, number | 'auto'] = [0, 'auto']
  let ticks: number[] | undefined
  const values = data.map(d => d[dataKey]).filter((v): v is number => typeof v === 'number')
  if (padded && values.length) {
    const lo = Math.floor((Math.min(...values) - 0.25) * 4) / 4
    const hi = Math.ceil((Math.max(...values) + 0.25) * 4) / 4
    const step = hi - lo > 1.5 ? 0.5 : 0.25
    domain = [lo, hi]
    ticks = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step)
  }
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={16} />
        <YAxis {...axis} allowDecimals={decimals > 0} width={decimals > 0 ? 44 : 36} domain={domain} ticks={ticks} tickFormatter={(v: number) => v.toFixed(decimals)} />
        <Tooltip {...tooltip} cursor={{ stroke: GRID }} formatter={(v: number) => [typeof v === 'number' ? v.toFixed(decimals) : 'Not tracked yet', label]} />
        <Line dataKey={dataKey} stroke={ORANGE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
          dot={{ r: 4, fill: ORANGE, stroke: SURFACE, strokeWidth: 2 }} activeDot={{ r: 5, stroke: SURFACE, strokeWidth: 2 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// Category bars (circle sizes, levels); `label` heads the tooltip.
export function CircleBars({ data, label }: { data: Row[]; label: string }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="size" {...axis} />
        <YAxis {...axis} allowDecimals={false} width={36} />
        <Tooltip {...tooltip} labelFormatter={(s: string) => `${label} ${s}`} formatter={(v: number) => [v, 'Players']} />
        <Bar dataKey="players" fill={ORANGE} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}
