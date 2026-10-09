/**
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when that env is
 * set on the project. Fail closed if it is missing — the route must not be
 * a public mail cannon.
 */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const auth = req.headers.get("authorization")
  return auth === `Bearer ${secret}`
}
