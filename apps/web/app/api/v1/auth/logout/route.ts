import { NextRequest, NextResponse } from "next/server"
import { ok } from "@/lib/api/respond"
import { destroySession } from "@/lib/auth/session"
import { safeNextPath } from "@/lib/auth/next-path"

export const dynamic = "force-dynamic"

/**
 * GET /api/v1/auth/logout — document bounce used by Server Components.
 *
 * RSC cannot delete cookies. When a listing has vanished (Vercel /tmp,
 * erasure, stale HMAC), pages redirect here so Set-Cookie happens on a
 * Route Handler, then the browser continues to sign-in or `next`.
 */
export async function GET(req: NextRequest): Promise<Response> {
  await destroySession()
  const next = safeNextPath(req.nextUrl.searchParams.get("next"))
  const stale = req.nextUrl.searchParams.get("stale") === "1"
  const dest = new URL(next ?? "/signin", req.url)
  if (stale && !next) dest.searchParams.set("stale", "1")
  return NextResponse.redirect(dest, 303)
}

/** POST /api/v1/auth/logout — clear the session cookie (Sign out button). */
export async function POST(): Promise<Response> {
  await destroySession()
  return ok({ signed_out: true })
}
