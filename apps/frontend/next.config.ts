import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['claims-test.more0.dev'],
  experimental: {
    // Turbopack FS cache was bloating to ~3GB and stalling Windows with
    // multi-minute "filesystem cache database compaction" + page loads.
    // Keep memory cache only in local dev.
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
