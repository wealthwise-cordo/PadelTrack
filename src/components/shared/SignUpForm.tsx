'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { inputClass, primaryButtonClass } from '@/components/shared/AuthShell'

// Creates an account and signs straight in. With claimToken, the account
// takes over that guest profile.
export default function SignUpForm({ claimToken, defaultName = '' }: { claimToken?: string; defaultName?: string }) {
  const router = useRouter()
  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, claimToken }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Could not create your account')
      setLoading(false)
      return
    }
    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error) {
      router.push('/login')
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-medium text-zinc-600 block mb-1.5">Name</label>
        <input value={name} onChange={e => setName(e.target.value)} required maxLength={40} autoComplete="name" className={inputClass} />
      </div>
      <div>
        <label className="text-xs font-medium text-zinc-600 block mb-1.5">Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" className={inputClass} />
      </div>
      <div>
        <label className="text-xs font-medium text-zinc-600 block mb-1.5">Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" className={inputClass} />
        <p className="text-[11px] text-muted-foreground mt-1">At least 8 characters</p>
      </div>
      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      <button type="submit" disabled={loading} className={primaryButtonClass}>
        {loading ? 'Creating account…' : claimToken ? 'Create account & claim profile' : 'Create account'}
      </button>
    </form>
  )
}
