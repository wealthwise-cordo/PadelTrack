'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { inputClass } from '@/components/shared/AuthShell'

// Sign-in and sign-up fields marked up the way browsers and password managers
// (iCloud Keychain, Google Password Manager, 1Password…) expect: stable
// name/id, a label tied to the input, and the standard autocomplete tokens,
// so they can offer saved details, suggest strong passwords and save logins.

const labelClass = 'text-xs font-medium text-zinc-600 block mb-1.5'

export function NameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor="name" className={labelClass}>Name</label>
      <input
        id="name"
        name="name"
        type="text"
        autoComplete="name"
        autoCapitalize="words"
        enterKeyHint="next"
        required
        maxLength={40}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={inputClass}
      />
    </div>
  )
}

// `purpose` picks the token password managers key on: on sign-in the email is
// the account's username; on sign-up it's offered from the device's contact
// card so it can be filled in one tap.
export function EmailField({ value, onChange, purpose }: { value: string; onChange: (v: string) => void; purpose: 'sign-in' | 'sign-up' }) {
  return (
    <div>
      <label htmlFor="email" className={labelClass}>Email</label>
      <input
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete={purpose === 'sign-in' ? 'username' : 'email'}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="next"
        required
        value={value}
        onChange={e => onChange(e.target.value)}
        className={inputClass}
      />
    </div>
  )
}

// New passwords get `new-password` plus Apple's `passwordrules`, so Safari
// and iOS suggest a strong password that meets our rule and save it.
export function PasswordField({ value, onChange, purpose }: { value: string; onChange: (v: string) => void; purpose: 'current' | 'new' }) {
  const [visible, setVisible] = useState(false)
  const isNew = purpose === 'new'
  return (
    <div>
      <label htmlFor="password" className={labelClass}>Password</label>
      <div className="relative">
        <input
          id="password"
          name="password"
          type={visible ? 'text' : 'password'}
          autoComplete={isNew ? 'new-password' : 'current-password'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          required
          minLength={isNew ? 8 : undefined}
          maxLength={72}
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`${inputClass} pr-12`}
          {...(isNew ? { passwordrules: 'minlength: 8; maxlength: 72;' } : {})}
        />
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 w-12 flex items-center justify-center text-zinc-400 hover:text-zinc-700"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {isNew && <p className="text-[11px] text-muted-foreground mt-1">At least 8 characters — or use your phone’s suggested password</p>}
    </div>
  )
}

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
]

const chevron = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }
const selectClass = `${inputClass} appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9`

// Dropdown; `sex` is the standard autofill token for gender.
export function GenderField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor="gender" className={labelClass}>Gender</label>
      <select
        id="gender"
        name="gender"
        autoComplete="sex"
        required
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`${selectClass} px-3 ${value ? '' : 'text-zinc-400'}`}
        style={chevron}
      >
        <option value="" disabled>Select</option>
        {GENDER_OPTIONS.map(o => <option key={o.value} value={o.value} className="text-zinc-900">{o.label}</option>)}
      </select>
    </div>
  )
}

// Native date picker; `bday` lets the phone fill it from the contact card.
export function DateOfBirthField({ value, onChange, max }: { value: string; onChange: (v: string) => void; max: string }) {
  return (
    <div>
      <label htmlFor="bday" className={labelClass}>Date of birth</label>
      <input
        id="bday"
        name="bday"
        type="date"
        autoComplete="bday"
        required
        min="1900-01-01"
        max={max || undefined}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`${inputClass} px-3 h-[50px] ${value ? "" : "text-zinc-400"}`}
      />
    </div>
  )
}

// Values are ISO country codes, matching the `country` autofill token.
export function CountryField({ value, onChange, countries }: { value: string; onChange: (v: string) => void; countries: { code: string; name: string }[] }) {
  return (
    <div>
      <label htmlFor="country" className={labelClass}>Location</label>
      <select
        id="country"
        name="country"
        autoComplete="country"
        required
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`${selectClass} ${value ? '' : 'text-zinc-400'}`}
        style={chevron}
      >
        <option value="" disabled>Select your country</option>
        {countries.map(c => <option key={c.code} value={c.code} className="text-zinc-900">{c.name}</option>)}
      </select>
    </div>
  )
}
