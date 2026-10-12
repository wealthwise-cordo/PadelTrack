'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { primaryButtonClass } from '@/components/shared/AuthShell'
import { PasswordField } from '@/components/shared/AuthFields'

// Sets the new password, then signs straight in with it.
export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Could not reset your password'); return }
      const result = await signIn('credentials', { email: d.email, password, redirect: false })
      router.push(result?.error ? '/login' : '/')
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PasswordField value={password} onChange={setPassword} purpose="new" />
      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      <button type="submit" disabled={loading} className={primaryButtonClass}>
        {loading ? 'Saving…' : 'Save new password'}
      </button>
    </form>
  )
}
