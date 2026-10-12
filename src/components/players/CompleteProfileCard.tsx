'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserCheck } from 'lucide-react'
import { GenderField, DateOfBirthField, CountryField } from '@/components/shared/AuthFields'
import { COUNTRIES } from '@/lib/countries'
import PushToggle from '@/components/shared/PushToggle'

// Shown on your own profile until gender, date of birth and country are
// filled in — players who joined from an invite link skipped them. It never
// blocks the app; it just stays here until saved.
export default function CompleteProfileCard() {
  const router = useRouter()
  const [gender, setGender] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [country, setCountry] = useState('GB')
  const [today, setToday] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const d = new Date()
    setToday(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gender, dateOfBirth, country }),
      })
      const d = await res.json()
      if (!res.ok) setError(d.error || 'Could not save')
      else router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="rounded-2xl border border-orange-200 bg-orange-50/60 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <UserCheck className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
        <div>
          <div className="text-sm font-bold">Complete your profile</div>
          <div className="text-xs text-zinc-600">Add your gender, date of birth and country.</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <GenderField value={gender} onChange={setGender} />
        <DateOfBirthField value={dateOfBirth} onChange={setDateOfBirth} max={today} />
      </div>
      <CountryField value={country} onChange={setCountry} countries={COUNTRIES} />
      <PushToggle variant="inline" />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button type="submit" disabled={saving} className="w-full py-2.5 rounded-xl font-bold text-sm bg-orange-500 text-white disabled:opacity-50">
        {saving ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
