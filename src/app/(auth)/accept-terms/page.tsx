import { redirect } from 'next/navigation'
import AuthShell from '@/components/shared/AuthShell'
import AcceptTerms from '@/components/shared/AcceptTerms'
import { getSession } from '@/lib/session'
import { getAccount } from '@/lib/store'

export const dynamic = 'force-dynamic'

// After signing in, for anyone who hasn't agreed to the current Terms of Use
// and Privacy notice (new, or updated since they last agreed). In the app,
// notifications are offered straight after (NativePushPrompt).
export default async function AcceptTermsPage({ searchParams }: { searchParams: { next?: string } }) {
  const session = await getSession()
  if (!session) redirect('/login')
  const next = searchParams.next?.startsWith('/') && !searchParams.next.startsWith('//') ? searchParams.next : '/'
  const account = await getAccount(session.userId)
  if (account?.termsCurrent) redirect(next)
  return (
    <AuthShell subtitle="Before you continue">
      <AcceptTerms next={next} />
    </AuthShell>
  )
}
