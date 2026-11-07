import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Type-checking is verified locally via `npx tsc --noEmit` before pushing;
    // skipping single-threaded tsc on Vercel's 2-vCPU build container saves ~75s per deploy.
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', '@tanstack/react-query'],
    serverActions: {
      bodySizeLimit: '15mb',
    },
    staleTimes: {
      dynamic: 300,   // Pages visited within 5min → instant from Router Cache
      static: 1800,   // Static pages cached 30min
    },
  },
  async headers() {
    return [
      {
        source: '/((?!api/r2-file).*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self)' },
        ],
      },
      {
        source: '/api/r2-file/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/report',
        destination: '/report.html',
      },
    ];
  },
};

export default nextConfig;
