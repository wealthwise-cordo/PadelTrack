'use client'

import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'

interface Props {
  onDelete: () => void
  deleting?: boolean
  children: React.ReactNode
}

const REVEAL_WIDTH = 76

export default function SwipeToDeleteRow({ onDelete, deleting, children }: Props) {
  const [translateX, setTranslateX] = useState(0)
  const dragging = useRef(false)
  const moved = useRef(false)
  const startX = useRef(0)
  const startTranslate = useRef(0)

  const start = (clientX: number) => {
    dragging.current = true
    moved.current = false
    startX.current = clientX
    startTranslate.current = translateX
  }
  const move = (clientX: number) => {
    if (!dragging.current) return
    const delta = clientX - startX.current
    if (Math.abs(delta) > 4) moved.current = true
    setTranslateX(Math.min(0, Math.max(-REVEAL_WIDTH, startTranslate.current + delta)))
  }
  const end = () => {
    if (!dragging.current) return
    dragging.current = false
    setTranslateX(t => (t < -REVEAL_WIDTH / 2 ? -REVEAL_WIDTH : 0))
  }

  const onClickCapture = (e: React.MouseEvent) => {
    if (moved.current || translateX !== 0) {
      e.preventDefault()
      e.stopPropagation()
      if (translateX !== 0) setTranslateX(0)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      {translateX !== 0 && (
        <button
          onClick={onDelete}
          disabled={deleting}
          className="absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-0.5 bg-red-500/90 text-white disabled:opacity-60 transition-opacity"
          style={{ width: REVEAL_WIDTH }}
        >
          <Trash2 className="h-4 w-4" />
          <span className="text-[9px] font-bold">{deleting ? '...' : 'Delete'}</span>
        </button>
      )}
      <div
        onTouchStart={e => start(e.touches[0].clientX)}
        onTouchMove={e => move(e.touches[0].clientX)}
        onTouchEnd={end}
        onMouseDown={e => start(e.clientX)}
        onMouseMove={e => move(e.clientX)}
        onMouseUp={end}
        onMouseLeave={() => dragging.current && end()}
        onClickCapture={onClickCapture}
        className="relative"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: dragging.current ? 'none' : 'transform 0.2s ease-out',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  )
}
