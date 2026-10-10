'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { primaryButtonClass } from '@/components/shared/AuthShell'

export default function ClaimButton({ token }: { token: string }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const claim = async () => {
    setLoading(true)
    setError('')
    const res = await fetch('/api/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Could not claim this profile')
      setLoading(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <button onClick={claim} disabled={loading} className={primaryButtonClass}>
        {loading ? 'Claiming…' : 'Claim this profile'}
      </button>
      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
    </div>
  )
}
