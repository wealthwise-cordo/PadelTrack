import { ImageResponse } from 'next/og'
import { LOGO_DATA_URI } from '@/lib/logo'

// The mark on the dark brand background, as a square PNG: iOS home screen
// and Android/PWA icons. The ball fills ~70% so it survives icon masks.
export function logoImage(size: number) {
  const ball = Math.round(size * 0.7)
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#18181b' }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={LOGO_DATA_URI} width={ball} height={ball} />
      </div>
    ),
    { width: size, height: size }
  )
}
