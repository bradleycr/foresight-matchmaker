/**
 * Runs once when the Next.js server boots (dev and production alike).
 *
 * With SEED_ON_EMPTY=true — the Docker default — a fresh volume gets the
 * synthetic demo directory automatically, so `docker compose up` produces a
 * working, browsable app with zero manual steps. A database that already
 * has profiles is never modified.
 */

/**
 * Env vars whose absence in production breaks the app in a way that is
 * invisible until the first request — a missing SESSION_SECRET throws deep
 * inside lib/auth/session.ts on first sign-in, which reads as a stack trace,
 * not a readable cause. Fail at boot instead, in the deploy log, where a
 * missing variable is an easy five-second fix rather than a live-demo panic.
 */
const REQUIRED_IN_PRODUCTION = ["SESSION_SECRET"] as const

function checkRequiredEnv(): void {
  if (process.env.NODE_ENV !== "production") return
  const missing = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key])
  if (missing.length === 0) return

  const message = [
    "",
    "=".repeat(72),
    "[boot] Missing required environment variable(s) in production:",
    ...missing.map((key) => `  - ${key}`),
    "",
    "Set these before the app can serve traffic. See .env.example.",
    "=".repeat(72),
    "",
  ].join("\n")
  // Loud and unambiguous in the deploy log, rather than a lazy throw buried
  // inside the first request's stack trace.
  console.error(message)
  throw new Error(`[boot] Missing required environment variable(s): ${missing.join(", ")}`)
}

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  checkRequiredEnv()

  // Auto-seed on Vercel preview/prod smoke deploys (ephemeral /tmp DB) and
  // when the Docker image explicitly opts in.
  const shouldSeed =
    process.env.SEED_ON_EMPTY === "true" ||
    (process.env.VERCEL === "1" && process.env.SEED_ON_EMPTY !== "false")
  if (!shouldSeed) return

  const { seedIfEmpty } = await import("./lib/db/seed-core")
  try {
    seedIfEmpty()
  } catch (error) {
    console.error("[seed] Auto-seed failed:", error)
  }
}
