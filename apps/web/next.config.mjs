import path from "node:path"
import { fileURLToPath } from "node:url"

const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone is for the Docker image only — Vercel’s builder needs the
  // default .next output (nft.json traces). Set STANDALONE=1 in the Dockerfile.
  ...(process.env.STANDALONE === "1" || (!process.env.VERCEL && process.env.DOCKER_BUILD === "1")
    ? { output: "standalone" }
    : {}),
  // Header tabs used to refetch every dynamic page from scratch (Next 15
  // defaulted this to 0). Thirty seconds is long enough to go back without
  // the skeleton, short enough that a newly published listing still appears.
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  // Local verification hits 127.0.0.1 (localhost is a different app on this machine).
  allowedDevOrigins: ["127.0.0.1"],
  // Trace from the monorepo root so workspace packages + seed/ ship with
  // serverless functions (opt-in via SEED_ON_EMPTY=true).
  outputFileTracingRoot: monorepoRoot,
  outputFileTracingIncludes: {
    "/**": ["../../seed/**/*"],
  },
  // better-sqlite3 is a native module — it must stay external to the bundle.
  serverExternalPackages: ["better-sqlite3"],
  images: {
    unoptimized: true,
  },
}

export default nextConfig
