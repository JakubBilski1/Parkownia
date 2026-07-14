import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for the Docker image (docs/ARCHITECTURE.md §3, deploy row).
  output: "standalone",
  reactStrictMode: true,
};

export default nextConfig;
