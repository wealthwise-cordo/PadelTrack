'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'

// Shares (or copies) a guest's join link. Joining through it hands them their
// profile and lets pending ranked matches count. `ranked` false is for a
// friendly, which has no deadline; `counts` is for a ranked guest, whose
// ranked matches count without joining.
export default function InviteButton({ name, claimToken, dark, ranked = true, counts = false }: { name: string; claimToken: string; dark?: boolean; ranked?: boolean; counts?: boolean }) {
  const [copied, setCopied] = useState(false)
  const first = name.split(' ')[0]

  const invite = async () => {
    const url = `${window.location.origin}/claim/${claimToken}`
    if (typeof navigator.share === 'function') {
      try {
        const text = !ranked
          ? 'I’ve recorded our friendly on PadelTrack — join to see it on your profile.'
          : counts
            ? 'I’ve recorded our match on PadelTrack — join to see it and your rating on your profile.'
            : 'I’ve recorded our match on PadelTrack — join within 48 hours so it counts as ranked.'
        await navigator.share({ title: 'Join me on PadelTrack', text, url })
        return
      } catch {
        // Share sheet dismissed — fall through to copying.
      }
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={invite}
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold transition active:scale-95 ${
        dark ? 'bg-white text-zinc-900' : 'bg-zinc-900 text-white'
      }`}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
      {copied ? 'Link copied' : `Invite ${first}`}
    </button>
  )
}
