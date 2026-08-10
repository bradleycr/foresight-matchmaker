/**
 * Tiny sliding-window rate limiter for single-node SQLite deployments.
 * Enough to stop inbox flooding and claim_link spraying; not a substitute
 * for an edge WAF in front of a public production host.
 */

interface Bucket {
  timestamps: number[]
}

const buckets = new Map<string, Bucket>()

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now()
  const bucket = buckets.get(key) ?? { timestamps: [] }
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < opts.windowMs)

  if (bucket.timestamps.length >= opts.limit) {
    const oldest = bucket.timestamps[0]!
    const retryAfterSec = Math.max(1, Math.ceil((opts.windowMs - (now - oldest)) / 1000))
    buckets.set(key, bucket)
    return { ok: false, retryAfterSec }
  }

  bucket.timestamps.push(now)
  buckets.set(key, bucket)
  return { ok: true }
}
