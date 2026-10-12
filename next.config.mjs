/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Runs src/instrumentation.ts at server start (error logging).
    instrumentationHook: true,
    serverActions: {
      allowedOrigins: ['localhost:3002'],
    },
  },
}

export default nextConfig
