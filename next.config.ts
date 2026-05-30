import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project (multiple lockfiles exist on the machine).
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
