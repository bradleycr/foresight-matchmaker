import { NextRequest, NextResponse } from "next/server"
import { verifyAdminSecret, writeAdminCookie } from "@/lib/auth/admin"

export const dynamic = "force-dynamic"

/**
 * POST /api/admin/login — exchange the shared secret for a signed cookie.
 *
 * A Route Handler (not a Server Action) so Set-Cookie survives the 303.
 * Next.js has dropped cookies set in a Server Action that then `redirect()`s,
 * which is exactly how /admin used to fail in production: the password was
 * accepted, the cookie never landed, and the page rendered the login form
 * again.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const form = await req.formData()
  const secret = String(form.get("secret") ?? "")
  const dest = new URL("/admin", req.nextUrl.origin)

  if (!verifyAdminSecret(secret)) {
    dest.searchParams.set("error", "1")
    return NextResponse.redirect(dest, 303)
  }

  const res = NextResponse.redirect(dest, 303)
  writeAdminCookie(res.cookies)
  return res
}
