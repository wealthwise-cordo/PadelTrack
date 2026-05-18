import { notFound, redirect } from 'next/navigation'
import { getMatchById } from '@/lib/store'
import MatchEditForm from '@/components/matches/MatchEditForm'

export const revalidate = 0

export default async function EditMatchPage({ params }: { params: { id: string } }) {
  const match = getMatchById(params.id)

  if (!match) notFound()
  if (match.status === 'complete') redirect('/matches')

  return (
    <div className="py-6 space-y-4">
      <h1 className="text-2xl font-black tracking-tight">Complete Match</h1>
      <p className="text-sm text-muted-foreground">Update the score and finalise the result.</p>
      <MatchEditForm match={match as any} />
    </div>
  )
}
