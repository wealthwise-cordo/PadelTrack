import Link from 'next/link'
import { CalendarOff } from 'lucide-react'

export default function NoActiveSeason() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
      <CalendarOff className="h-8 w-8 text-muted-foreground" />
      <div>
        <div className="text-sm font-semibold">No active season</div>
        <div className="text-xs text-muted-foreground mt-1">
          The last season has been closed. Start a new one from the admin panel to continue.
        </div>
      </div>
      <Link
        href="/admin"
        className="text-xs font-bold px-4 py-2 rounded-xl bg-neon-green text-background hover:bg-neon-green/90 transition-all"
      >
        Go to Admin
      </Link>
    </div>
  )
}
