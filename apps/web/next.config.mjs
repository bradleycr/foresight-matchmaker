/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server bundle for the Docker image (node server.js).
  output: "standalone",
  // better-sqlite3 is a native module — it must stay external to the bundle.
  serverExternalPackages: ["better-sqlite3"],
  images: {
    unoptimized: true,
  },
}

export default nextConfig
