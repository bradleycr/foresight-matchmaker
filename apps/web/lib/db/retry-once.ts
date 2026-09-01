/**
 * One delayed retry for a durable write that can flake on a cold isolate
 * (TypeError: fetch failed to Supabase). Callers log the first miss as a
 * warning; a second miss still throws so the existing persist-failed path
 * can record it. Listings do not use this — their retry stays as-is.
 */
const DEFAULT_WAIT_MS = 250

export async function retryOnce<T>(
  op: () => Promise<T>,
  onRetry: (error: unknown) => void,
  waitMs = DEFAULT_WAIT_MS,
): Promise<T> {
  try {
    return await op()
  } catch (error) {
    onRetry(error)
    if (waitMs > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, waitMs)
      })
    }
    return await op()
  }
}
