'use client'

import { useEffect, useRef, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { isNativeApp } from '@/lib/native'

// The page under the header, and the two swipes that move it. The header
// (logo, tabs, account menu) never moves; only this does.
//
// - The three main tabs sit side by side in a strip, joined at the edges.
//   A sideways drag moves the whole strip with your finger; let go and it
//   settles on the nearest page (or the next one, if you flicked). Grab it
//   while it's still moving and it stops under your finger, so you can swipe
//   back and forth as fast as you like.
// - Anywhere else, in the iPhone app, a drag in from the left edge slides the
//   page off to the right, uncovering the page you came from underneath.
//
// While swiping, the pages are snapshots of how they looked when you last
// left them (a skeleton if you haven't been there yet). The real page takes
// over once the strip has stopped and that page has loaded, so you never see
// a blank screen. The iPhone's own back swipe, which moved the whole screen
// header and all, is off (ios/App/App/SceneDelegate.swift).
export const TAB_ROOTS = ['/', '/matches', '/events']

const EDGE = 28 // px from the left edge where a back swipe can start
const COMMIT = 0.33 // share of the width past which a released back swipe carries on
const FLICK = 0.4 // px/ms: a quick flick carries on however far it went
const DURATION = 280 // ms for a full page's slide
const SETTLE = 80 // ms the real page gets to settle before it's shown
const FADE = 140 // ms the snapshot takes to fade into the real page

type Snapshot = { html: string; scrollY: number }
const snapshots = new Map<string, Snapshot>()
// Where you've been, oldest first, so a back swipe knows what to uncover.
const trail: string[] = []

// Sent the moment a swipe (or a tap on a tab) commits to a page, so the
// header's tab underline moves straight away rather than once it has loaded.
export const HEADING_TO_EVENT = 'pt:heading-to'
export const headingTo = (url: string) => window.dispatchEvent(new CustomEvent<string>(HEADING_TO_EVENT, { detail: url }))

// The last page you were on outside the given section (Admin's close button).
export function pageBefore(section: string): string {
  for (let i = trail.length - 1; i >= 0; i--) if (!trail[i].startsWith(section)) return trail[i]
  return '/'
}

// Admin has its own close button (which also locks it), so no back swipe there.
const NO_BACK_SWIPE = ['/admin']

const SKELETON = `<div class="py-6 space-y-5 animate-pulse"><div class="glass rounded-2xl p-4 flex items-center gap-3"><div class="h-12 w-12 rounded-xl bg-zinc-200"></div><div class="flex-1 space-y-2"><div class="h-4 w-1/3 rounded bg-zinc-200"></div><div class="h-3 w-1/2 rounded bg-zinc-100"></div></div></div><div class="glass rounded-xl p-4 space-y-3">${'<div class="flex items-center gap-3"><div class="h-8 w-8 rounded-full bg-zinc-200"></div><div class="flex-1 h-3 rounded bg-zinc-100"></div><div class="h-3 w-10 rounded bg-zinc-200"></div></div>'.repeat(5)}</div></div>`

const here = () => window.location.pathname + window.location.search
const loading = (main: HTMLElement) => !!main.querySelector('[aria-busy="true"]')
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

// Swipes between tabs that start on something that scrolls sideways (a
// carousel, a filter bar, a chart) or a form field are left alone.
function ignoreFrom(target: EventTarget | null): boolean {
  for (let el = target instanceof Element ? target : null; el && el !== document.body; el = el.parentElement) {
    if (el.matches('input, textarea, select, [contenteditable="true"], [data-no-tab-swipe]')) return true
    const style = getComputedStyle(el)
    if (/(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth) return true
  }
  return false
}

// A snapshot page: the saved page, scrolled to `scrollY`, without anything
// fixed to the screen (the Save bar).
function makePane(html: string, scrollY: number): HTMLElement {
  const pane = document.createElement('div')
  pane.className = 'absolute inset-0 overflow-hidden bg-white will-change-transform'
  pane.innerHTML = `<div class="px-4 pb-10 max-w-3xl mx-auto">${html}</div>`
  pane.querySelectorAll('.fixed').forEach(el => el.remove())
  ;(pane.firstElementChild as HTMLElement).style.transform = `translateY(${-scrollY}px)`
  return pane
}

// How fast the finger was moving at the end (px/ms; negative = leftwards).
function speed(samples: { x: number; t: number }[]): number {
  const a = samples[0], b = samples[samples.length - 1]
  return (b.x - a.x) / Math.max(1, b.t - a.t)
}

export default function TabSwipe({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const mainRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  // Set while a swipe is waiting for its page: the page, and what to do once
  // it has loaded.
  const arriving = useRef<{ url: string; done: () => void } | null>(null)
  // True while any navigation a swipe started is still under way, so a page
  // left behind by quick swipes can't arrive late and flash up.
  const [navPending, startNav] = useTransition()
  const navPendingRef = useRef(false)
  navPendingRef.current = navPending

  const snap = () => {
    const main = mainRef.current
    if (!main || arriving.current || loading(main) || main.style.visibility === 'hidden') return
    const s = { html: main.innerHTML, scrollY: window.scrollY }
    snapshots.set(here(), s)
    // Tabs are also kept under their plain address, for the strip.
    if (TAB_ROOTS.includes(window.location.pathname)) snapshots.set(window.location.pathname, s)
    while (snapshots.size > 25) snapshots.delete(snapshots.keys().next().value!)
  }

  // Keep the trail of pages and a fresh snapshot of this one: when it has
  // settled, as you scroll, and just before you tap away from it.
  useEffect(() => {
    const url = here()
    if (trail[trail.length - 2] === url) trail.pop()
    else if (trail[trail.length - 1] !== url) {
      // A page you've just opened starts at the top. (Next.js lines the page
      // up with the top of the screen, which leaves its first lines under
      // the pinned header.) Going back keeps where you were.
      if (trail.length) window.scrollTo(0, 0)
      trail.push(url)
    }
    if (trail.length > 50) trail.shift()

    const settle = setTimeout(snap, 600)
    let scrollTimer: ReturnType<typeof setTimeout> | undefined
    const onScroll = () => {
      clearTimeout(scrollTimer)
      scrollTimer = setTimeout(() => {
        const s = snapshots.get(here())
        if (s && !arriving.current && mainRef.current?.style.visibility !== 'hidden') s.scrollY = window.scrollY
      }, 150)
    }
    document.addEventListener('click', snap, true)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      clearTimeout(settle)
      clearTimeout(scrollTimer)
      document.removeEventListener('click', snap, true)
      window.removeEventListener('scroll', onScroll)
    }
  }, [pathname])

  // Once the page a swipe is waiting for has loaded, say so.
  useEffect(() => {
    const main = mainRef.current
    if (!main) return
    const check = () => {
      const a = arriving.current
      if (a && !navPendingRef.current && here() === a.url && !loading(main)) a.done()
    }
    check()
    const observer = new MutationObserver(check)
    observer.observe(main, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [pathname, navPending])

  // On a tab, all three load in the background, so a swipe lands at once.
  const onTab = TAB_ROOTS.includes(pathname)
  useEffect(() => {
    if (onTab) for (const href of TAB_ROOTS) router.prefetch(href)
  }, [onTab, router])

  useEffect(() => {
    const main = mainRef.current
    const stage = stageRef.current
    if (!main || !stage) return
    const backSwipes = isNativeApp() || (navigator as { standalone?: boolean }).standalone === true
    const width = () => window.innerWidth
    const headerBottom = () => document.querySelector('header')?.getBoundingClientRect().bottom ?? 0

    // What the snapshot stage is showing: the tab strip, a back swipe, or
    // nothing (just the real page).
    let mode: 'strip' | 'back' | null = null
    let fallback: ReturnType<typeof setTimeout> | undefined
    // Ends the closing fade at once, when a new swipe starts during it.
    let fading: (() => void) | null = null

    const showStage = (children: HTMLElement[]) => {
      fading?.()
      stage.replaceChildren(...children)
      stage.style.top = `${headerBottom()}px`
      stage.style.transition = stage.style.opacity = ''
      stage.style.display = 'block'
    }

    // Wait for `url` to have loaded (or a few seconds, whatever happens),
    // then call `then`.
    const waitFor = (url: string, then: () => void) => {
      clearTimeout(fallback)
      const done = () => {
        if (arriving.current?.done !== done) return
        clearTimeout(fallback)
        arriving.current = null
        then()
      }
      arriving.current = { url, done }
      fallback = setTimeout(() => { if (arriving.current?.done === done) { arriving.current = null; then() } }, 4000)
      if (!navPendingRef.current && here() === url && !loading(main)) done()
    }

    const go = (url: string, back: boolean) => startNav(() => {
      if (back && trail[trail.length - 2] === url && window.history.length > 1) router.back()
      else router.push(url)
    })

    // Hand over to the real page: a moment for it to settle (dates and cards
    // that fill in once shown), then the snapshots fade away over it.
    const closeStage = (scrollY: number, stillWanted: () => boolean) => {
      setTimeout(() => {
        if (!stillWanted()) return
        window.scrollTo(0, scrollY)
        main.style.visibility = ''
        main.style.transition = main.style.left = main.style.zIndex = main.style.boxShadow = ''
        stage.style.transition = `opacity ${FADE}ms ease-out`
        stage.style.opacity = '0'
        mode = null
        strip = null
        back = null
        const done = () => {
          fading = null
          stage.style.display = 'none'
          stage.style.transition = stage.style.opacity = ''
          stage.replaceChildren()
        }
        fading = done
        setTimeout(() => { if (fading === done) done() }, FADE)
      }, SETTLE)
    }

    // ---- The tab strip ----

    let strip: {
      panes: HTMLElement[]
      scrollYs: number[] // where each page is scrolled to
      pos: number // 0 = Ranking in view, 1 = Match Centre, 2 = Events (fractions in between)
      target: number // the page it's settling on
      raf: number // animation frame while settling, 0 when still
    } | null = null

    const render = () => {
      if (!strip) return
      const s = strip
      const w = width()
      s.panes.forEach((p, i) => { p.style.transform = `translate3d(${(i - s.pos) * w}px,0,0)` })
    }

    const openStrip = () => {
      const current = TAB_ROOTS.indexOf(window.location.pathname)
      snap()
      const scrollYs = TAB_ROOTS.map((_, i) => (i === current ? window.scrollY : 0))
      const panes = TAB_ROOTS.map((url, i) =>
        makePane(i === current ? main.innerHTML : snapshots.get(url)?.html ?? SKELETON, scrollYs[i]))
      strip = { panes, scrollYs, pos: current, target: current, raf: 0 }
      mode = 'strip'
      showStage(panes)
      render()
      main.style.visibility = 'hidden'
    }

    // Once the strip has stopped and its page has loaded, the real page takes over.
    const stripReady = () => {
      if (!strip || strip.raf || drag) return
      const s = strip
      waitFor(TAB_ROOTS[s.target], () => closeStage(s.scrollYs[s.target], () => strip === s && !s.raf && !drag && !arriving.current))
    }

    const settleOn = (target: number) => {
      if (!strip) return
      const s = strip
      cancelAnimationFrame(s.raf)
      s.target = target
      const url = TAB_ROOTS[target]
      headingTo(url)
      // Load it now, while the strip is still moving.
      if (url !== here() || navPendingRef.current) go(url, false)
      const from = s.pos
      const time = Math.max(120, Math.abs(target - from) * DURATION)
      const t0 = performance.now()
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / time)
        s.pos = from + (target - from) * easeOut(t)
        render()
        if (t < 1) s.raf = requestAnimationFrame(step)
        else { s.raf = 0; stripReady() }
      }
      s.raf = requestAnimationFrame(step)
    }

    // ---- The back swipe ----

    let back: { under: HTMLElement; target: string; scrollY: number; pinned: HTMLElement[] } | null = null

    // The real page moves by its left offset rather than a transform, which
    // would unpin bars fixed to the bottom of the screen (the Save bar);
    // those move alongside it.
    const placeBack = (dx: number, animate: boolean) => {
      if (!back) return
      const curve = `${DURATION}ms cubic-bezier(.2,.8,.2,1)`
      main.style.transition = animate ? `left ${curve}` : 'none'
      main.style.left = dx ? `${dx}px` : ''
      for (const p of back.pinned) {
        p.style.transition = animate ? `transform ${curve}` : 'none'
        p.style.transform = dx ? `translate3d(${dx}px,0,0)` : ''
      }
      back.under.style.transition = animate ? `transform ${curve}` : 'none'
      // Underneath, moving a little slower, like the iPhone's own.
      back.under.style.transform = `translate3d(${(dx - width()) * 0.3}px,0,0)`
    }

    const openBack = () => {
      snap()
      const target = trail[trail.length - 2] ?? '/'
      const saved = snapshots.get(target)
      back = { under: makePane(saved?.html ?? SKELETON, saved?.scrollY ?? 0), target, scrollY: saved?.scrollY ?? 0, pinned: Array.from(main.querySelectorAll<HTMLElement>('.fixed')) }
      mode = 'back'
      showStage([back.under])
      main.style.zIndex = '20'
      main.style.boxShadow = '-8px 0 24px rgba(0,0,0,0.12)'
    }

    const endBack = (landed: boolean) => {
      if (!back) return
      const b = back
      for (const p of b.pinned) p.style.transition = p.style.transform = ''
      main.style.transition = main.style.left = main.style.zIndex = main.style.boxShadow = ''
      if (!landed) {
        stage.style.display = 'none'
        stage.replaceChildren()
        back = null
        mode = null
        return
      }
      main.style.visibility = 'hidden'
      headingTo(b.target)
      go(b.target, true)
      waitFor(b.target, () => closeStage(b.scrollY, () => back === b))
    }

    // ---- Touch ----

    let drag: {
      kind: 'strip' | 'back'
      decided: boolean // false until the finger has shown it's going sideways
      x0: number; y0: number
      startPos: number
      samples: { x: number; t: number }[]
    } | null = null

    const onStart = (e: TouchEvent) => {
      if (drag || e.touches.length !== 1 || mode === 'back') return
      if (document.querySelector('[role=dialog]')) return
      const t = e.touches[0]
      if (t.clientY < headerBottom()) return
      const samples = [{ x: t.clientX, t: e.timeStamp }]
      if (strip) {
        // Caught while moving or waiting to load: it stops under your finger.
        cancelAnimationFrame(strip.raf)
        strip.raf = 0
        arriving.current = null
        drag = { kind: 'strip', decided: false, x0: t.clientX, y0: t.clientY, startPos: strip.pos, samples }
        return
      }
      const path = window.location.pathname
      if (TAB_ROOTS.includes(path)) {
        if (ignoreFrom(e.target)) return
        drag = { kind: 'strip', decided: false, x0: t.clientX, y0: t.clientY, startPos: TAB_ROOTS.indexOf(path), samples }
      } else if (backSwipes && t.clientX <= EDGE && !arriving.current && !NO_BACK_SWIPE.some(p => path.startsWith(p))) {
        drag = { kind: 'back', decided: false, x0: t.clientX, y0: t.clientY, startPos: 0, samples }
      }
    }

    const onMove = (e: TouchEvent) => {
      if (!drag) return
      const t = e.touches[0]
      const dx = t.clientX - drag.x0
      const dy = t.clientY - drag.y0
      if (!drag.decided) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
        // Mostly up or down: it's a scroll, not a swipe.
        if (Math.abs(dy) > Math.abs(dx) * 0.8 || (drag.kind === 'back' && dx < 0)) {
          drag = null
          if (strip) settleOn(Math.round(strip.pos))
          return
        }
        drag.decided = true
        drag.x0 = t.clientX // start from here, so the page doesn't jump
        if (drag.kind === 'strip') {
          if (!strip) openStrip()
          drag.startPos = strip!.pos
        } else {
          openBack()
        }
      }
      e.preventDefault()
      drag.samples.push({ x: t.clientX, t: e.timeStamp })
      if (drag.samples.length > 6) drag.samples.shift()
      const d = t.clientX - drag.x0
      if (drag.kind === 'strip' && strip) {
        // Past the first or last tab: a little give, then it stops.
        const raw = drag.startPos - d / width()
        const last = TAB_ROOTS.length - 1
        strip.pos = raw < 0 ? raw / 4 : raw > last ? last + (raw - last) / 4 : raw
        render()
      } else {
        placeBack(Math.max(0, d), false)
      }
    }

    const onEnd = (e: TouchEvent) => {
      if (!drag) return
      const d = drag
      drag = null
      if (d.kind === 'strip') {
        if (!strip) return
        // A tap on a moving strip: it carries on to where it was going.
        if (!d.decided) return settleOn(strip.target)
        const v = speed(d.samples)
        let target = Math.round(strip.pos)
        if (v < -FLICK) target = Math.floor(strip.pos) + 1
        if (v > FLICK) target = Math.ceil(strip.pos) - 1
        settleOn(Math.min(TAB_ROOTS.length - 1, Math.max(0, target)))
        return
      }
      if (!d.decided || !back) return
      const dx = parseFloat(main.style.left) || 0
      const landed = e.type === 'touchend' && (dx > width() * COMMIT || speed(d.samples) > FLICK)
      placeBack(landed ? width() : 0, true)
      setTimeout(() => endBack(landed), DURATION)
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd, { passive: true })
    document.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      clearTimeout(fallback)
      if (strip) cancelAnimationFrame(strip.raf)
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onEnd)
    }
  }, [router, startNav])

  return (
    <div className="relative [overflow-x:clip]">
      <main ref={mainRef} className="relative px-4 pb-10 max-w-3xl mx-auto bg-white min-h-[calc(100dvh-7rem)]">
        {children}
      </main>
      {/* Snapshots while swiping: the strip of tabs, or the page underneath
          a back swipe, until the real page has loaded. */}
      <div ref={stageRef} aria-hidden="true" className="fixed inset-x-0 bottom-0 z-10 hidden overflow-hidden pointer-events-none" />
    </div>
  )
}
