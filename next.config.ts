import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Increased from 1MB to support larger images
    },
  },
};

export default nextConfig;
