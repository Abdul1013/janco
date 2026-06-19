import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Silence the "multiple lockfiles" workspace root warning
    root: __dirname,
  },
};

export default nextConfig;
