import path from "node:path"
import { fileURLToPath } from "node:url"

const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server bundle for the Docker image (node server.js).
  // Vercel ignores this and uses its own output pipeline.
  output: "standalone",
  // Trace from the monorepo root so workspace packages + seed/ ship with
  // serverless functions (needed for SEED_ON_EMPTY on Vercel).
  outputFileTracingRoot: monorepoRoot,
  outputFileTracingIncludes: {
    "/**": ["./seed/**/*", "../../seed/**/*"],
  },
  // better-sqlite3 is a native module — it must stay external to the bundle.
  serverExternalPackages: ["better-sqlite3"],
  images: {
    unoptimized: true,
  },
}

export default nextConfig
