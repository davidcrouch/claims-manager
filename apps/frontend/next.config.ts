import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['claims-test.more0.dev'],
};

export default nextConfig;

