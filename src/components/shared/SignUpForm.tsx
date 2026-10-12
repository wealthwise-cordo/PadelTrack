'use client'

import { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { primaryButtonClass } from '@/components/shared/AuthShell'
import { NameField, EmailField, PasswordField, GenderField, DateOfBirthField, CountryField } from '@/components/shared/AuthFields'
import { COUNTRIES } from '@/lib/countries'
import LevelPicker from '@/components/shared/LevelPicker'
import PushToggle from '@/components/shared/PushToggle'

// Creates an account and signs straight in. The LTA level picked here sets
// the starting rating. With claimToken, the account takes over that guest
// profile; suggestedLevel (from whoever added them) is pre-selected, and the
// server starts them at the lower of the two.
// `heading` and `footer` show while signing up and are hidden on the
// notifications step that follows a direct sign-up.
export default function SignUpForm({ claimToken, defaultName = '', suggestedLevel = null, collectProfile = false, heading, footer }: { claimToken?: string; defaultName?: string; suggestedLevel?: number | null; collectProfile?: boolean; heading?: string; footer?: React.ReactNode }) {
  const router = useRouter()
  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [level, setLevel] = useState<number | null>(suggestedLevel)
  // Direct sign-up only: gender, date of birth and country.
  const [gender, setGender] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [country, setCountry] = useState('')
  const [today, setToday] = useState('')
  useEffect(() => {
    const d = new Date()
    setToday(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }, [])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [accepted, setAccepted] = useState(false)
  // Direct sign-ups get one more step: turning on phone notifications.
  // (Invite-link sign-ups are offered it in "Complete your profile".)
  const [created, setCreated] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (collectProfile && !gender) {
      setError('Choose your gender')
      return
    }
    if (level === null) {
      setError('Pick the level that best describes you')
      return
    }
    if (!accepted) {
      setError('Please agree to the Terms and Privacy Notice')
      return
    }
    setLoading(true)
    setError('')
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, level, claimToken, acceptTerms: accepted, ...(collectProfile && { gender, dateOfBirth, country }) }),
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
    if (!claimToken) {
      setCreated(true)
      setLoading(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  const goToApp = () => {
    router.push('/')
    router.refresh()
  }

  if (created) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="text-lg font-black">You’re all set, {name.trim().split(' ')[0]}</div>
          <p className="text-sm text-zinc-600 mt-1">One last thing — want a heads-up on your phone?</p>
        </div>
        <PushToggle variant="inline" onUnavailable={goToApp} />
        <button type="button" onClick={goToApp} className={primaryButtonClass}>
          Continue to PadelTrack
        </button>
      </div>
    )
  }

  return (
    <>
    {heading && <p className="text-sm text-muted-foreground text-center mb-6">{heading}</p>}
    <form onSubmit={handleSubmit} method="post" className="space-y-4">
      <NameField value={name} onChange={setName} />
      <EmailField value={email} onChange={setEmail} purpose="sign-up" />
      <PasswordField value={password} onChange={setPassword} purpose="new" />
      {collectProfile && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <GenderField value={gender} onChange={v => { setGender(v); setError('') }} />
            <DateOfBirthField value={dateOfBirth} onChange={setDateOfBirth} max={today} />
          </div>
          <CountryField value={country} onChange={setCountry} countries={COUNTRIES} />
        </>
      )}
      <LevelPicker
        value={level}
        onChange={l => { setLevel(l); setError('') }}
        hint="Based on the LTA Padel Rating System — this may be the same as an existing rating you have on Playtomic or similar"
      />
      <label className="flex items-start gap-2.5 text-xs text-zinc-600 leading-relaxed cursor-pointer">
        <input
          type="checkbox"
          name="accept-terms"
          required
          checked={accepted}
          onChange={e => { setAccepted(e.target.checked); setError('') }}
          className="mt-0.5 h-4 w-4 shrink-0 accent-orange-500"
        />
        <span>
          I agree to the <a href="/terms" target="_blank" className="font-semibold text-orange-600 underline">Terms of Use</a>, including liability and safety, and I’ve read the{' '}
          <a href="/privacy" target="_blank" className="font-semibold text-orange-600 underline">Privacy Notice</a>.
        </span>
      </label>
      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      <button type="submit" disabled={loading} className={primaryButtonClass}>
        {loading ? 'Creating account…' : claimToken ? 'Create account & claim profile' : 'Create account'}
      </button>
    </form>
    {footer}
    </>
  )
}
