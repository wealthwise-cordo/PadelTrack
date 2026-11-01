/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Runs src/instrumentation.ts at server start (error logging).
    instrumentationHook: true,
    serverActions: {
      allowedOrigins: ['localhost:3002'],
    },
  },
  // The Terms of Use and Privacy notice are standalone documents in public/
  // (terms.html, privacy.html); the old addresses still work.
  async redirects() {
    return [
      { source: '/terms', destination: '/terms.html', permanent: true },
      { source: '/privacy', destination: '/privacy.html', permanent: true },
      { source: '/liability', destination: '/terms.html', permanent: true },
    ]
  },
}

export default nextConfig
