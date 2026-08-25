import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const applicationDirectory = dirname(fileURLToPath(import.meta.url));
const isVercelBuild = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  // Vercel provides its own Next.js build adapter and does not use the
  // standalone output. Next.js 16.3 currently fails when both are enabled.
  ...(isVercelBuild
    ? {}
    : {
        output: "standalone" as const,
        outputFileTracingRoot: resolve(applicationDirectory, "../.."),
      }),
};

export default nextConfig;
