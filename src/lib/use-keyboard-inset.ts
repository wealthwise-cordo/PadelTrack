'use client'

import { useEffect, useState } from 'react'

// How much of the bottom of the screen the on-screen keyboard covers, in px.
// iOS Safari (and the home-screen app) overlays the keyboard instead of
// shrinking the page, so anything fixed to `bottom: 0` ends up hidden behind
// it. The visual viewport is the part still visible; the gap between its
// bottom edge and the window's is the keyboard. `viewportHeight` is that
// visible height, for capping a sheet so it fits above the keyboard.
export function useKeyboardInset(active = true) {
  const [state, setState] = useState({ inset: 0, viewportHeight: 0 })

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!active || !vv) return
    const update = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
      setState({ inset, viewportHeight: Math.round(vv.height) })
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [active])

  return state
}
