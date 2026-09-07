import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const applicationDirectory = dirname(fileURLToPath(import.meta.url));
const isVercelBuild = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { formats: ["image/avif", "image/webp"] },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
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
