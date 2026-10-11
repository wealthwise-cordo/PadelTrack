'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { LTA_CATEGORIES, LTA_LEVELS, categoryOf, type LtaCategory } from '@/lib/lta'

// Pick an LTA Padel Rating level. All twelve statements scroll inside a short
// window (so the rest of the form stays in view); the Beginner / Intermediate
// / Advanced tabs above it follow along as you scroll and jump straight to a
// group when tapped.
export default function LevelPicker({
  value,
  onChange,
  label = 'Your level',
  hint,
  aboutSomeoneElse = false,
}: {
  value: number | null
  onChange: (level: number) => void
  label?: string
  hint?: string
  // Word the statements about a guest ("They…") instead of "I…".
  aboutSomeoneElse?: boolean
}) {
  const [active, setActive] = useState<LtaCategory>(value !== null ? categoryOf(value) : 'beginner')
  const listRef = useRef<HTMLDivElement>(null)
  const groupRefs = useRef<Record<LtaCategory, HTMLDivElement | null>>({ beginner: null, intermediate: null, advanced: null })
  const initialLevel = useRef(value)
  // While a tab tap is scrolling the list, don't let the scroll listener fight it.
  const jumping = useRef<LtaCategory | null>(null)

  const offsetInList = (el: HTMLElement) => {
    const list = listRef.current!
    return el.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop - 6
  }

  // The active tab is the last group that has reached the top of the window,
  // or the last group once the list is scrolled to the very end.
  const syncActive = useCallback(() => {
    const list = listRef.current
    if (!list) return
    let current: LtaCategory = 'beginner'
    for (const c of LTA_CATEGORIES) {
      const el = groupRefs.current[c.key]
      if (el && offsetInList(el) <= list.scrollTop + 8) current = c.key
    }
    if (list.scrollTop > 0 && list.scrollTop + list.clientHeight >= list.scrollHeight - 4) {
      current = LTA_CATEGORIES[LTA_CATEGORIES.length - 1].key
    }
    if (jumping.current) {
      if (current === jumping.current) jumping.current = null
      return
    }
    setActive(current)
  }, [])

  // Open on the pre-selected level's group.
  useEffect(() => {
    const list = listRef.current
    const level = initialLevel.current
    if (list && level !== null) {
      const el = groupRefs.current[categoryOf(level)]
      if (el) list.scrollTop = offsetInList(el)
    }
    syncActive()
  }, [syncActive])

  const jumpTo = (c: LtaCategory) => {
    const list = listRef.current
    const el = groupRefs.current[c]
    if (!list || !el) return
    setActive(c)
    jumping.current = c
    list.scrollTo({ top: offsetInList(el), behavior: 'smooth' })
    // Release the lock even if the list can't scroll that far (last group).
    setTimeout(() => { jumping.current = null }, 600)
  }

  return (
    <fieldset>
      <legend className="text-xs font-medium text-zinc-600 mb-1.5">{label}</legend>
      {hint && <p className="text-[11px] text-zinc-500 -mt-0.5 mb-2">{hint}</p>}

      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-100 mb-2" role="tablist" aria-label="Jump to playing standard">
        {LTA_CATEGORIES.map(c => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={active === c.key}
            onClick={() => jumpTo(c.key)}
            className={`h-10 rounded-lg text-[13px] font-bold transition ${active === c.key ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <div
          ref={listRef}
          onScroll={syncActive}
          role="radiogroup"
          aria-label="Level"
          className="h-60 overflow-y-auto overscroll-contain rounded-xl border border-zinc-200 bg-zinc-50 p-1.5 space-y-1.5"
        >
          {LTA_CATEGORIES.map(c => (
            <div key={c.key} ref={el => { groupRefs.current[c.key] = el }} className="space-y-1.5">
              {LTA_LEVELS.filter(l => l.category === c.key).map(l => {
                const selected = value === l.level
                return (
                  <button
                    key={l.level}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onChange(l.level)}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition active:scale-[0.99] ${
                      selected ? 'border-orange-500 bg-orange-50' : 'border-zinc-200 bg-white'
                    }`}
                  >
                    <span className={`shrink-0 min-w-[2.75rem] h-8 px-2 rounded-lg flex items-center justify-center font-mono text-sm font-black ${
                      selected ? 'bg-orange-500 text-white' : 'bg-zinc-100 text-zinc-700'
                    }`}>
                      {l.level.toFixed(1)}
                    </span>
                    <span className="flex-1 text-[13px] leading-snug text-zinc-700 pt-1">{aboutSomeoneElse ? l.aboutThem : l.statement}</span>
                    {selected && <Check className="h-4 w-4 text-orange-600 shrink-0 mt-2" />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        {/* Soft fade hinting there's more to scroll. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-px bottom-px h-6 rounded-b-xl bg-gradient-to-t from-zinc-50 to-transparent" />
      </div>
    </fieldset>
  )
}
