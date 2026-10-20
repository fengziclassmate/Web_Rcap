import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: ["192.168.42.213"],
  // Restored build caches previously served stale task-table CSS on Vercel.
  experimental: { turbopackFileSystemCacheForBuild: false },
};

export default nextConfig;
