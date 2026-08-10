import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "@rmm/schema": path.resolve(__dirname, "../../packages/schema/src/index.ts"),
      "@rmm/matching": path.resolve(__dirname, "../../packages/matching/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
})
