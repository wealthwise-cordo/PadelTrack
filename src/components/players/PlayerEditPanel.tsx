'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Pencil, Check, X, KeyRound, Trash2 } from 'lucide-react'
import { getInitials } from '@/lib/utils'

const PALETTE = [
  '#f97316', '#ea580c', '#3f3f46', '#18181b',
  '#0ea5e9', '#2563eb', '#8b5cf6', '#c026d3',
  '#10b981', '#059669', '#e11d48', '#dc2626',
  '#f59e0b', '#ca8a04', '#64748b', '#0f766e',
]

interface Props {
  playerId: string
  name: string
  nickname: string | null
  avatarColor: string
  // Your own profile only: the name and email you signed up with. Unlocks the
  // display name and password change.
  account?: { name: string; email: string } | null
}

const fieldClass = 'w-full bg-zinc-900/5 border border-zinc-900/10 rounded-lg px-3 py-2 text-base sm:text-sm focus:outline-none focus:border-orange-500'

export default function PlayerEditPanel({ playerId, name, nickname, avatarColor, account }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [displayName, setDisplayName] = useState(name)
  const [color, setColor] = useState(avatarColor)
  const [nick, setNick] = useState(nickname ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function reset() {
    setDisplayName(name)
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
        body: JSON.stringify({ ...(account && { name: displayName.trim() }), nickname: nick.trim(), avatarColor: color }),
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
          {/* Display name — shown everywhere; the account keeps the sign-up name */}
          {account && (
            <div>
              <label htmlFor="display-name" className="text-xs text-muted-foreground mb-1.5 block">Display name</label>
              <input autoComplete="nickname"
                id="display-name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                maxLength={40}
                className={fieldClass}
              />
              <p className="text-[11px] text-muted-foreground mt-1">How you appear across PadelTrack. Your account name stays {account.name}.</p>
            </div>
          )}

          {/* Color picker */}
          <div>
            <div className="text-xs text-muted-foreground mb-2">Avatar colour</div>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold text-background shrink-0"
                style={{ backgroundColor: color }}
              >
                {getInitials(account ? displayName || name : name)}
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
            <input autoComplete="off"
              value={nick}
              onChange={e => setNick(e.target.value)}
              maxLength={30}
              placeholder="e.g. The Hammer"
              className={fieldClass}
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving || (!!account && !displayName.trim())}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-orange-500 text-white text-sm font-bold disabled:opacity-40 transition-all"
            >
              <Check className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={reset}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900/5 text-sm text-muted-foreground hover:text-foreground transition-all"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>

          {account && <ChangePassword email={account.email} />}
          {account && <DeleteAccount email={account.email} />}
        </div>
      )}
    </div>
  )
}

// Marked up like the sign-in form (hidden username + current/new password
// tokens) so password managers update the saved login instead of adding one.
function ChangePassword({ email }: { email: string }) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const d = await res.json()
      if (!res.ok) setError(d.error || 'Could not change password')
      else {
        setDone(true)
        setOpen(false)
        setCurrent('')
        setNext('')
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pt-4 border-t border-zinc-900/10">
      {!open ? (
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => { setOpen(true); setDone(false) }} className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 hover:text-zinc-900">
            <KeyRound className="h-4 w-4 text-orange-500" />
            Change password
          </button>
          {done && <span className="text-xs text-emerald-700">Password updated</span>}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div className="text-sm font-semibold flex items-center gap-1.5"><KeyRound className="h-4 w-4 text-orange-500" /> Change password</div>
          <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
          <div>
            <label htmlFor="current-password" className="text-xs text-muted-foreground mb-1.5 block">Current password</label>
            <input id="current-password" name="current-password" type="password" autoComplete="current-password" required
              value={current} onChange={e => setCurrent(e.target.value)} className={fieldClass} />
          </div>
          <div>
            <label htmlFor="new-password" className="text-xs text-muted-foreground mb-1.5 block">New password</label>
            <input id="new-password" name="new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={72}
              value={next} onChange={e => setNext(e.target.value)} className={fieldClass}
              {...{ passwordrules: 'minlength: 8; maxlength: 72;' }} />
            <p className="text-[11px] text-muted-foreground mt-1">At least 8 characters</p>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-zinc-900 text-white text-sm font-bold disabled:opacity-40">
              {saving ? 'Updating…' : 'Update password'}
            </button>
            <button type="button" onClick={() => { setOpen(false); setError(''); setCurrent(''); setNext('') }} className="px-4 py-2 rounded-lg bg-zinc-900/5 text-sm text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// Permanent: needs the password, then signs out. Confirmed results keep the
// player's name (see deleteAccount).
function DeleteAccount({ email }: { email: string }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setDeleting(true)
    setError('')
    try {
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d.error || 'Could not delete account')
        setDeleting(false)
      } else {
        await signOut({ callbackUrl: '/login' })
      }
    } catch {
      setError('Network error')
      setDeleting(false)
    }
  }

  return (
    <div className="pt-4 border-t border-zinc-900/10">
      {!open ? (
        <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700">
          <Trash2 className="h-4 w-4" />
          Delete account
        </button>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div className="text-sm font-semibold flex items-center gap-1.5 text-red-600"><Trash2 className="h-4 w-4" /> Delete account</div>
          <p className="text-xs text-muted-foreground">
            This permanently deletes your account and personal details and can’t be undone. Your name stays on matches already confirmed, but your profile is removed and you leave everyone’s circle. Pending matches you’re in are removed.
          </p>
          <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
          <div>
            <label htmlFor="delete-password" className="text-xs text-muted-foreground mb-1.5 block">Enter your password to confirm</label>
            <input id="delete-password" name="password" type="password" autoComplete="current-password" required
              value={password} onChange={e => setPassword(e.target.value)} className={fieldClass} />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={deleting || !password} className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-bold disabled:opacity-40">
              {deleting ? 'Deleting…' : 'Delete my account'}
            </button>
            <button type="button" onClick={() => { setOpen(false); setError(''); setPassword('') }} className="px-4 py-2 rounded-lg bg-zinc-900/5 text-sm text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
