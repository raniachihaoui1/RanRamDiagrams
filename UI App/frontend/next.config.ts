import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server build for Docker / deploy.
  output: "standalone",
};

export default nextConfig;
