'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Check, X } from 'lucide-react'
import { getInitials } from '@/lib/utils'

const PALETTE = [
  '#00ff87', '#00d4ff', '#a855f7', '#ff6b35',
  '#fbbf24', '#f472b6', '#34d399', '#60a5fa',
  '#f87171', '#fb923c', '#e879f9', '#38bdf8',
  '#4ade80', '#facc15', '#c084fc', '#94a3b8',
]

interface Props {
  playerId: string
  name: string
  nickname: string | null
  avatarColor: string
}

export default function PlayerEditPanel({ playerId, name, nickname, avatarColor }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [color, setColor] = useState(avatarColor)
  const [nick, setNick] = useState(nickname ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function reset() {
    setColor(avatarColor)
    setNick(nickname ?? '')
    setError('')
    setOpen(false)
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/players/${playerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nick.trim(), avatarColor: color }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Save failed')
      } else {
        setOpen(false)
        router.refresh()
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Pencil className="h-3 w-3" />
        Edit profile
      </button>

      {open && (
        <div className="mt-4 glass rounded-xl p-4 space-y-4">
          {/* Color picker */}
          <div>
            <div className="text-xs text-muted-foreground mb-2">Avatar colour</div>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold text-background shrink-0"
                style={{ backgroundColor: color }}
              >
                {getInitials(name)}
              </div>
              <span className="font-mono text-xs text-muted-foreground">{color}</span>
            </div>
            <div className="grid grid-cols-8 gap-1.5">
              {PALETTE.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="h-7 w-7 rounded-lg transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    outline: color === c ? `2px solid ${c}` : undefined,
                    outlineOffset: color === c ? '2px' : undefined,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Nickname */}
          <div>
            <div className="text-xs text-muted-foreground mb-1.5">Nickname</div>
            <input
              value={nick}
              onChange={e => setNick(e.target.value)}
              maxLength={30}
              placeholder="e.g. The Hammer"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neon-green/50"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-neon-green text-background text-sm font-bold disabled:opacity-40 transition-all"
            >
              <Check className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={reset}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 text-sm text-muted-foreground hover:text-foreground transition-all"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
