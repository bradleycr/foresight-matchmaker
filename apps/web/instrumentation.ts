/**
 * Runs once when the Next.js server boots (dev and production alike).
 *
 * With SEED_ON_EMPTY=true — the Docker default — a fresh volume gets the
 * synthetic demo directory automatically, so `docker compose up` produces a
 * working, browsable app with zero manual steps. A database that already
 * has profiles is never modified.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  if (process.env.SEED_ON_EMPTY !== "true") return

  const { seedIfEmpty } = await import("./lib/db/seed-core")
  try {
    seedIfEmpty()
  } catch (error) {
    console.error("[seed] Auto-seed failed:", error)
  }
}
