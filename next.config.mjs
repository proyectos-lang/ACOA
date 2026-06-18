/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        // Cuando entren exactamente a /edce
        source: '/edce',
        destination: 'https://v0-supabase-dashboard-setup-drab.vercel.app/edce',
      },
      {
        // Cuando entren a cualquier subruta como /edce/rrhh
        source: '/edce/:path*',
        destination: 'https://v0-supabase-dashboard-setup-drab.vercel.app/edce/:path*',
      },
    ]
  },
}

export default nextConfig
