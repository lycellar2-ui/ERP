import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Router Cache: browser caches page RSC payload for instant tab switching
    // - User clicks tab A → tab B → tab A: instant (from browser cache)
    // - After mutation: revalidatePath() auto-clears this cache for affected paths
    staleTimes: {
      dynamic: 30,   // ISR pages: browser caches 30s (matches shortest revalidate)
      static: 300,   // static pages: browser caches 5min
    },
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
