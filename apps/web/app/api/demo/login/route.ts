import { NextRequest, NextResponse } from "next/server"
import { DEMO_EMAIL, verifyDemoSecret } from "@/lib/auth/demo"
import { createSession } from "@/lib/auth/session"
import { rateLimit } from "@/lib/auth/rate-limit"
import { ensureOwnedListing, persistListing, persistSignup } from "@/lib/db/durable"
import { getProfilesByEmail, markClaimed } from "@/lib/db/profiles"

export const dynamic = "force-dynamic"

/**
 * POST /api/demo/login — password → bradley@foresight.org session → /me.
 *
 * Route Handler (not a Server Action) so Set-Cookie survives the 303, same
 * pattern as /api/admin/login. Skips magic-link mail so a fresh laptop can
 * demo without inbox access.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const form = await req.formData()
  const secret = String(form.get("secret") ?? "")
  const fail = new URL("/demo", req.nextUrl.origin)

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  const limited = rateLimit(`demo-login:${ip}`, { limit: 20, windowMs: 15 * 60 * 1000 })
  if (!limited.ok) {
    fail.searchParams.set("error", "1")
    return NextResponse.redirect(fail, 303)
  }

  if (!verifyDemoSecret(secret)) {
    fail.searchParams.set("error", "1")
    return NextResponse.redirect(fail, 303)
  }

  await ensureOwnedListing(null, DEMO_EMAIL)
  const profile = getProfilesByEmail(DEMO_EMAIL)[0]
  const profileId = profile?.id ?? null

  if (!profileId) {
    fail.searchParams.set("error", "1")
    return NextResponse.redirect(fail, 303)
  }

  markClaimed(profileId)
  try {
    await persistSignup({
      email: DEMO_EMAIL,
      confirmed_at: new Date().toISOString(),
      profile_id: profileId,
    })
  } catch (error) {
    console.error("[demo] persist signup failed", error)
  }
  try {
    const claimed = getProfilesByEmail(DEMO_EMAIL)[0]
    if (claimed) await persistListing(claimed)
  } catch (error) {
    console.error("[demo] persist listing failed", error)
  }

  const res = NextResponse.redirect(new URL("/me", req.nextUrl.origin), 303)
  await createSession(profileId, DEMO_EMAIL, res.cookies)
  return res
}
