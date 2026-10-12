import Link from 'next/link'
import AuthShell from '@/components/shared/AuthShell'
import SignUpForm from '@/components/shared/SignUpForm'

export default function SignUpPage() {
  return (
    <AuthShell>
      <SignUpForm
        collectProfile
        heading="Create your account"
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
