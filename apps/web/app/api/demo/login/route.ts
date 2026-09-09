import { NextRequest, NextResponse } from "next/server"
import { DEMO_EMAIL, resolveDemoCity, resolveDemoEmail, verifyDemoSecret } from "@/lib/auth/demo"
import { createSession } from "@/lib/auth/session"
import { rateLimit } from "@/lib/auth/rate-limit"
import { ensureOwnedListing, hydrateEvents, hydrateListings, persistListing, persistSignup } from "@/lib/db/durable"
import { flushEvent, listEvents, logEvent } from "@/lib/db/events"
import { getProfilesByEmail, markClaimed } from "@/lib/db/profiles"
import { isCheckedIn } from "@/lib/onsite/presence"

export const dynamic = "force-dynamic"

/**
 * POST /api/demo/login — password → session for a listed email → /me
 * (or /here/{city} when checking into a room).
 *
 * Skips magic-link mail so a fresh laptop — or a guest stuck without inbox
 * access — can land on the board during an event.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const form = await req.formData()
  const secret = String(form.get("secret") ?? "")
  const email = resolveDemoEmail(String(form.get("email") ?? ""))
  const city = resolveDemoCity(String(form.get("city") ?? ""))
  const fail = new URL("/demo", req.nextUrl.origin)

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  const limited = rateLimit(`demo-login:${ip}`, { limit: 30, windowMs: 15 * 60 * 1000 })
  if (!limited.ok) {
    fail.searchParams.set("error", "1")
    return NextResponse.redirect(fail, 303)
  }

  if (!verifyDemoSecret(secret)) {
    fail.searchParams.set("error", "1")
    return NextResponse.redirect(fail, 303)
  }

  await Promise.all([hydrateListings(), hydrateEvents({ force: true })])
  await ensureOwnedListing(null, email)
  const profile = getProfilesByEmail(email)[0]
  const profileId = profile?.id ?? null

  if (!profileId || !profile) {
    fail.searchParams.set("error", "missing")
    if (email !== DEMO_EMAIL) fail.searchParams.set("email", email)
    return NextResponse.redirect(fail, 303)
  }

  markClaimed(profileId)
  try {
    await persistSignup({
      email,
      confirmed_at: new Date().toISOString(),
      profile_id: profileId,
    })
  } catch (error) {
    console.error("[demo] persist signup failed", error)
  }
  try {
    await persistListing(profile)
  } catch (error) {
    console.error("[demo] persist listing failed", error)
  }

  if (city && !isCheckedIn(listEvents(), city, profileId)) {
    const event = logEvent("onsite_checkin", profileId, {
      city,
      attending: profile.attending,
      operator: true,
    })
    await flushEvent(event)
  }

  const next = city ? `/here/${city}` : "/me"
  const res = NextResponse.redirect(new URL(next, req.nextUrl.origin), 303)
  await createSession(profileId, email, res.cookies)
  return res
}
