import Link from 'next/link'
import AuthShell from '@/components/shared/AuthShell'
import ResetPasswordForm from '@/components/shared/ResetPasswordForm'
import { isResetTokenValid } from '@/lib/store'

export const dynamic = 'force-dynamic'

export default async function ResetPasswordPage({ params }: { params: { token: string } }) {
  const valid = await isResetTokenValid(params.token)
  return (
    <AuthShell subtitle="Set a new password">
      {valid ? (
        <ResetPasswordForm token={params.token} />
      ) : (
        <div className="text-center space-y-4">
          <p className="text-sm">This reset link has expired or has already been used.</p>
          <Link href="/forgot-password" className="inline-block font-semibold text-orange-600 hover:underline text-sm">Send a new link</Link>
        </div>
      )}
    </AuthShell>
  )
}
