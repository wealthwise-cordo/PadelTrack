'use client'

import { useState } from 'react'
import Link from 'next/link'
import AuthShell, { primaryButtonClass } from '@/components/shared/AuthShell'
import { EmailField } from '@/components/shared/AuthFields'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/password/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const d = await res.json()
      if (!res.ok) setError(d.error || 'Something went wrong')
      else setSent(true)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell subtitle="Reset your password">
      {sent ? (
        <div className="text-center space-y-3">
          <p className="text-sm">If <span className="font-semibold">{email.trim()}</span> has a PadelTrack account, we’ve sent it a link to reset your password.</p>
          <p className="text-xs text-muted-foreground">The link expires in 1 hour. Check your spam folder if it doesn’t arrive.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-zinc-600">Enter the email you signed up with and we’ll send you a link to set a new password.</p>
          <EmailField value={email} onChange={setEmail} purpose="sign-in" />
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          <button type="submit" disabled={loading} className={primaryButtonClass}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
      <p className="text-sm text-muted-foreground text-center mt-6">
        <Link href="/login" className="font-semibold text-orange-600 hover:underline">Back to sign in</Link>
      </p>
    </AuthShell>
  )
}
