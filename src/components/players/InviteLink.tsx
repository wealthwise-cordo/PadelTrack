'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, Share2 } from 'lucide-react'

export default function InviteLink({ token, name }: { token: string; name: string }) {
  const [url, setUrl] = useState(`/claim/${token}`)
  const [copied, setCopied] = useState(false)
  const [canShare, setCanShare] = useState(false)

  useEffect(() => {
    setUrl(`${window.location.origin}/claim/${token}`)
    setCanShare(typeof navigator.share === 'function')
  }, [token])

  const copy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="glass rounded-xl p-4 space-y-3 !border-orange-200 !bg-orange-50/60">
      <div>
        <h2 className="text-sm font-bold">Invite {name.split(' ')[0]} to PadelTrack</h2>
        <p className="text-xs text-zinc-600 mt-0.5">
          Send this link. When they sign up through it, this profile — rating and matches — becomes theirs.
        </p>
      </div>
      <div className="flex gap-2">
        <input autoComplete="off" readOnly value={url} onFocus={e => e.target.select()} className="flex-1 min-w-0 bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs font-mono text-zinc-700" />
        <button onClick={copy} className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 shrink-0">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        {canShare && (
          <button
            onClick={() => navigator.share({ title: 'Join me on PadelTrack', url }).catch(() => {})}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold bg-orange-500 text-white hover:bg-orange-600 shrink-0"
          >
            <Share2 className="h-3.5 w-3.5" /> Share
          </button>
        )}
      </div>
    </div>
  )
}
