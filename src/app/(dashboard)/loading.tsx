// Shown the moment you tap to another page, while the server builds it, so
// navigation responds straight away. The navbar (in the layout) stays put.
export default function Loading() {
  return (
    <div className="py-6 space-y-5 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="glass rounded-2xl p-4 flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-zinc-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/3 rounded bg-zinc-200" />
          <div className="h-3 w-1/2 rounded bg-zinc-100" />
        </div>
      </div>
      <div className="glass rounded-xl p-4 space-y-3">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-zinc-200" />
            <div className="flex-1 h-3 rounded bg-zinc-100" />
            <div className="h-3 w-10 rounded bg-zinc-200" />
          </div>
        ))}
      </div>
    </div>
  )
}
