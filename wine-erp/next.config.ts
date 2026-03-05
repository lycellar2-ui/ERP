import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Cache page responses in browser for 30s (dynamic) / 180s (static)
    // This makes back-and-forth navigation between dashboard pages instant
    staleTimes: {
      dynamic: 30,   // force-dynamic pages cached 30s in browser
      static: 180,   // static pages cached 3min in browser
    },
  },
};

export default nextConfig;
