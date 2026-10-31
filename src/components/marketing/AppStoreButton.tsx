import { Smartphone } from 'lucide-react'

// "Download on the App Store". Set NEXT_PUBLIC_APP_STORE_ID (the app's Apple
// ID from App Store Connect → App Information) once it's live; until then it
// says the app is coming soon. Swap the drawn badge for Apple's official badge
// artwork before launch (developer.apple.com/app-store/marketing/guidelines).
export const APP_STORE_ID = process.env.NEXT_PUBLIC_APP_STORE_ID

export default function AppStoreButton() {
  const inner = (
    <>
      <Smartphone className="h-6 w-6" aria-hidden="true" />
      <span className="text-left leading-none">
        <span className="block text-[10px] font-medium">{APP_STORE_ID ? 'Download on the' : 'Coming soon to the'}</span>
        <span className="block text-lg font-semibold -mt-0.5">App Store</span>
      </span>
    </>
  )
  const cls = 'inline-flex items-center gap-2 h-12 pl-3 pr-4 rounded-xl bg-black text-white ring-1 ring-white/25'
  return APP_STORE_ID
    ? <a href={`https://apps.apple.com/app/id${APP_STORE_ID}`} className={`${cls} hover:bg-zinc-800 transition`}>{inner}</a>
    : <span className={`${cls} opacity-80`} aria-label="Coming soon to the App Store">{inner}</span>
}
