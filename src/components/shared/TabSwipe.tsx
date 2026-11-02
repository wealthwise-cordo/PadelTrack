'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

// The three main tabs, in order. Swiping left (finger right to left) on one
// goes to the next, swiping right to the previous — like a native tab bar.
// They're the app's base layer: the iPhone back swipe is off on these
// (ios/App/App/SceneDelegate.swift), so a swipe right on Ranking does nothing.
export const TAB_ROOTS = ['/', '/matches', '/events']

const MIN_DISTANCE = 70
const MAX_DURATION = 700

// Swipes that start on something that scrolls sideways (a carousel, a filter
// bar, a chart), a form field or an open sheet are left alone.
function ignoreFrom(target: EventTarget | null): boolean {
  if (document.querySelector('[role=dialog]')) return true
  for (let el = target instanceof Element ? target : null; el && el !== document.body; el = el.parentElement) {
    if (el.matches('input, textarea, select, [contenteditable="true"], [data-no-tab-swipe]')) return true
    const style = getComputedStyle(el)
    if (/(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth) return true
  }
  return false
}

export default function TabSwipe() {
  const router = useRouter()
  const pathname = usePathname()
  const index = TAB_ROOTS.indexOf(pathname)

  useEffect(() => {
    if (index < 0) return
    let start: { x: number; y: number; t: number } | null = null
    const onStart = (e: TouchEvent) => {
      start = e.touches.length === 1 && !ignoreFrom(e.target) ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null
    }
    const onEnd = (e: TouchEvent) => {
      if (!start) return
      const touch = e.changedTouches[0]
      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y
      const quick = Date.now() - start.t < MAX_DURATION
      start = null
      if (!quick || Math.abs(dx) < MIN_DISTANCE || Math.abs(dy) > Math.abs(dx) * 0.6) return
      const next = TAB_ROOTS[index + (dx < 0 ? 1 : -1)]
      if (next) router.push(next)
    }
    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchend', onEnd)
    }
  }, [index, router])

  // The neighbouring tabs load in the background, so a swipe lands at once.
  useEffect(() => {
    if (index < 0) return
    for (const href of [TAB_ROOTS[index - 1], TAB_ROOTS[index + 1]]) if (href) router.prefetch(href)
  }, [index, router])

  return null
}
