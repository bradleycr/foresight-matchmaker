import { NextRequest, NextResponse } from "next/server"
import { verifyAdminSecret, writeAdminCookie } from "@/lib/auth/admin"

export const dynamic = "force-dynamic"

/** Only `/admin` and `/admin/{slug}` — never an open redirect. */
function safeAdminNext(value: string | null): string {
  if (!value) return "/admin"
  if (value === "/admin") return value
  if (/^\/admin\/[a-z0-9-]+$/.test(value)) return value
  return "/admin"
}

/**
 * POST /api/admin/login — exchange the shared secret for a signed cookie.
 *
 * A Route Handler (not a Server Action) so Set-Cookie survives the 303.
 * Optional `next` returns to the admin page that asked for the secret.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const form = await req.formData()
  const secret = String(form.get("secret") ?? "")
  const next = safeAdminNext(String(form.get("next") ?? "/admin"))
  const dest = new URL(next, req.nextUrl.origin)

  if (!verifyAdminSecret(secret)) {
    dest.searchParams.set("error", "1")
    return NextResponse.redirect(dest, 303)
  }

  const res = NextResponse.redirect(dest, 303)
  writeAdminCookie(res.cookies)
  return res
}
