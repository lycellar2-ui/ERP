import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Cache page responses in browser (Router Cache)
    // This makes back-and-forth navigation between dashboard pages instant
    staleTimes: {
      dynamic: 60,   // force-dynamic pages cached 60s in browser (was 30s)
      static: 300,   // static pages cached 5min in browser (was 180s)
    },
  },
};

export default nextConfig;

