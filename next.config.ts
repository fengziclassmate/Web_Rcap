import type { NextConfig } from "next";

const isStaticExport = process.env.EXPORT_STATIC === "1";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.42.213"],
  ...(isStaticExport ? { output: "export" as const } : {}),
};

export default nextConfig;
