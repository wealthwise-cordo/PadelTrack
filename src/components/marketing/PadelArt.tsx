// Padel illustrations for the sign-up landing page, drawn as inline SVG so
// they stay sharp at any size and need no image files.

const BALL = '#d9f99d'
const BALL_EDGE = '#a3e635'

// A padel court from above, 20 × 10 m at 10 units per metre: glass back walls,
// glass then mesh along the sides, net in the middle, service boxes either side.
export function Court({ className }: { className?: string }) {
  const x0 = 20
  const y0 = 15
  const net = x0 + 100
  const service = 69.5 // service lines sit 6.95 m from the net
  return (
    <svg viewBox="0 0 240 130" className={className} role="img" aria-label="A padel court seen from above">
      <defs>
        <linearGradient id="court-surface" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f97316" />
          <stop offset="1" stopColor="#ea580c" />
        </linearGradient>
      </defs>
      {/* surround */}
      <rect x="4" y="2" width="232" height="126" rx="10" fill="#27272a" />
      {/* playing surface */}
      <rect x={x0} y={y0} width="200" height="100" rx="2" fill="url(#court-surface)" />
      {/* lines */}
      <g stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round">
        <line x1={net - service} y1={y0} x2={net - service} y2={y0 + 100} />
        <line x1={net + service} y1={y0} x2={net + service} y2={y0 + 100} />
        <line x1={net - service} y1={y0 + 50} x2={net + service} y2={y0 + 50} />
      </g>
      {/* glass back walls, glass then mesh down the sides */}
      <g stroke="#e0f2fe" strokeOpacity="0.85" strokeWidth="3.5" strokeLinecap="round" fill="none">
        <line x1={x0} y1={y0} x2={x0} y2={y0 + 100} />
        <line x1={x0 + 200} y1={y0} x2={x0 + 200} y2={y0 + 100} />
        {[y0, y0 + 100].map(y => (
          <g key={y}>
            <line x1={x0} y1={y} x2={x0 + 40} y2={y} />
            <line x1={x0 + 160} y1={y} x2={x0 + 200} y2={y} />
          </g>
        ))}
      </g>
      <g stroke="#a1a1aa" strokeWidth="2" strokeDasharray="2 2.5" fill="none">
        <line x1={x0 + 40} y1={y0} x2={x0 + 160} y2={y0} />
        <line x1={x0 + 40} y1={y0 + 100} x2={x0 + 160} y2={y0 + 100} />
      </g>
      {/* net */}
      <line x1={net} y1={y0 - 4} x2={net} y2={y0 + 104} stroke="#18181b" strokeWidth="2.5" />
      <line x1={net} y1={y0 - 4} x2={net} y2={y0 + 104} stroke="white" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
      <circle cx={net} cy={y0 - 4} r="2.2" fill="#18181b" />
      <circle cx={net} cy={y0 + 104} r="2.2" fill="#18181b" />
      {/* four players, as dots */}
      {[
        [x0 + 30, y0 + 28, '#18181b'], [x0 + 55, y0 + 74, '#18181b'],
        [x0 + 150, y0 + 30, 'white'], [x0 + 172, y0 + 70, 'white'],
      ].map(([cx, cy, fill]) => (
        <circle key={`${cx}-${cy}`} cx={cx as number} cy={cy as number} r="5" fill={fill as string} stroke="#18181b" strokeOpacity="0.25" strokeWidth="1" />
      ))}
      {/* a shot in flight */}
      <path d={`M ${x0 + 58} ${y0 + 70} Q ${net} ${y0 + 10} ${x0 + 146} ${y0 + 36}`} stroke={BALL} strokeWidth="1.4" strokeDasharray="3 3" fill="none" />
      <circle cx={x0 + 146} cy={y0 + 36} r="3.6" fill={BALL} stroke={BALL_EDGE} strokeWidth="1" />
    </svg>
  )
}

// A padel racket: solid perforated face, open throat, short grip and strap.
export function Racket({ className }: { className?: string }) {
  const holes: [number, number][] = []
  for (let row = 0; row < 7; row++) {
    const y = 32 + row * 11
    const half = row === 0 || row === 6 ? 2 : row === 1 || row === 5 ? 3 : 4
    for (let i = -half; i <= half; i++) holes.push([60 + i * 10 + (row % 2 ? 5 : 0), y])
  }
  return (
    <svg viewBox="0 0 120 220" className={className} aria-hidden="true">
      {/* strap */}
      <path d="M 54 196 q -14 16 6 20 q 20 -4 6 -20" fill="none" stroke="#a1a1aa" strokeWidth="2.5" />
      {/* grip */}
      <rect x="51" y="132" width="18" height="66" rx="5" fill="#18181b" />
      {[142, 152, 162, 172, 182].map(y => (
        <line key={y} x1="51" y1={y} x2="69" y2={y + 5} stroke="#3f3f46" strokeWidth="2" />
      ))}
      {/* throat */}
      <path d="M 40 112 Q 60 128 54 140 L 66 140 Q 60 128 80 112 Z" fill="#f97316" />
      <path d="M 50 118 Q 60 124 70 118 Q 60 130 50 118 Z" fill="#18181b" opacity="0.85" />
      {/* face */}
      <path d="M 60 8 C 98 8 112 36 110 64 C 108 94 88 118 60 120 C 32 118 12 94 10 64 C 8 36 22 8 60 8 Z" fill="#f97316" stroke="#c2410c" strokeWidth="3" />
      <path d="M 60 16 C 92 16 103 40 101 64 C 99 90 82 110 60 112 C 38 110 21 90 19 64 C 17 40 28 16 60 16 Z" fill="#fb923c" />
      {holes.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="2.6" fill="#c2410c" opacity="0.7" />
      ))}
    </svg>
  )
}

export function Ball({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill={BALL} stroke={BALL_EDGE} strokeWidth="2" />
      <path d="M 6 9 C 16 14 16 26 6 31" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 34 9 C 24 14 24 26 34 31" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
