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
  // Trace from the monorepo root so workspace packages + seed/ ship with
  // serverless functions (needed for SEED_ON_EMPTY on Vercel).
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
