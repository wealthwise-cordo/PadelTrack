import { LOGO_DATA_URI } from '@/lib/logo'

// The PadelTrack mark and wordmark, as used in every header.
export default function Logo() {
  return (
    <span className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_DATA_URI} alt="" className="h-8 w-8" />
      <span className="font-black text-lg tracking-tight">
        Padel<span className="text-orange-500">Track</span>
      </span>
    </span>
  )
}
