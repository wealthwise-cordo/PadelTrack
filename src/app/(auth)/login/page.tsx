'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import AuthShell, { primaryButtonClass } from '@/components/shared/AuthShell'
import { EmailField, PasswordField } from '@/components/shared/AuthFields'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const next = useSearchParams().get('next') || '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error) {
      setError('Wrong email or password')
      setLoading(false)
    } else {
      router.push(next.startsWith('/') ? next : '/')
      router.refresh()
    }
  }

  return (
    <AuthShell subtitle="Sign in to see your rankings">
      <form onSubmit={handleSubmit} method="post" className="space-y-4">
        <EmailField value={email} onChange={setEmail} purpose="sign-in" />
        <PasswordField value={password} onChange={setPassword} purpose="current" />
        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
        <button type="submit" disabled={loading} className={primaryButtonClass}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="text-sm text-muted-foreground text-center mt-6">
        New to PadelTrack?{' '}
        <Link href="/signup" className="font-semibold text-orange-600 hover:underline">Create an account</Link>
      </p>
    </AuthShell>
  )
}
