import type { Metadata } from 'next'
import Link from 'next/link'
import AuthShell from '@/components/shared/AuthShell'
import SignUpForm from '@/components/shared/SignUpForm'

// Creating an account: from the welcome page at /, the sign-in screen, or
// the iPhone app's first open (see middleware.ts). Sign in sits top right.
// Guest invite links (/claim/…) have their own sign-up.
export const metadata: Metadata = { title: 'Create an account · PadelTrack' }

export default function SignUpPage() {
  return (
    <AuthShell subtitle="Create your account to start tracking your matches" headerLink={{ href: '/login', label: 'Sign in' }}>
      <SignUpForm
        collectProfile
        footer={
          <p className="text-sm text-muted-foreground text-center mt-6">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-orange-600 hover:underline">Sign in</Link>
          </p>
        }
      />
    </AuthShell>
  )
}
