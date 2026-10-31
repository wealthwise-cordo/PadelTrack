import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import NativeBridge from '@/components/shared/NativeBridge'
import { APP_STORE_ID } from '@/components/marketing/AppStoreButton'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'PadelTrack',
  description: 'Rankings for you and the people you play padel with.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PadelTrack',
  },
  // Safari on iPhone shows its own "Open" / "Get" bar for the app on every
  // page (never inside the app itself). Needs NEXT_PUBLIC_APP_STORE_ID.
  ...(APP_STORE_ID && { itunes: { appId: APP_STORE_ID } }),
}

export const viewport: Viewport = {
  themeColor: '#18181b',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background antialiased">
        {children}
        <NativeBridge />
      </body>
    </html>
  )
}
