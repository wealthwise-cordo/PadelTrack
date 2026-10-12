import { ImageResponse } from 'next/og'

// The preview card shown when /signup is shared (WhatsApp, iMessage, socials).
export const alt = 'PadelTrack — padel rankings for you and your crew'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#18181b', color: 'white', padding: 64, fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 }}>
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 900 }}>
            Padel<span style={{ color: '#f97316' }}>Track</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 28, fontSize: 64, fontWeight: 900, lineHeight: 1.05 }}>
            <span>Settle it on court.</span>
            <span style={{ color: '#f97316' }}>Prove it on the table.</span>
          </div>
          <div style={{ marginTop: 28, fontSize: 28, color: '#d4d4d8', maxWidth: 560 }}>
            Padel ratings on the LTA 1.0–7.0 scale, opponent-confirmed results and rankings for the people you play with. Free.
          </div>
        </div>
        {/* A simple court from above */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ position: 'relative', display: 'flex', width: 300, height: 480, background: '#f97316', borderRadius: 8, border: '8px solid #e0f2fe' }}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 232, height: 6, background: '#18181b' }} />
            <div style={{ position: 'absolute', left: 0, right: 0, top: 66, height: 3, background: 'white' }} />
            <div style={{ position: 'absolute', left: 0, right: 0, top: 397, height: 3, background: 'white' }} />
            <div style={{ position: 'absolute', left: 141, top: 66, width: 3, height: 334, background: 'white' }} />
            <div style={{ position: 'absolute', left: 190, top: 120, width: 30, height: 30, borderRadius: 15, background: '#d9f99d', border: '3px solid #a3e635' }} />
          </div>
        </div>
      </div>
    ),
    size
  )
}
