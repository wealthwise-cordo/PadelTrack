import { logoImage } from '@/lib/logo-image'

// Home-screen icons listed in the web app manifest: /pwa-icon/192, /pwa-icon/512.
export function GET(_req: Request, { params }: { params: { size: string } }) {
  const size = Number(params.size)
  if (size !== 192 && size !== 512) return new Response('Not found', { status: 404 })
  return logoImage(size)
}
