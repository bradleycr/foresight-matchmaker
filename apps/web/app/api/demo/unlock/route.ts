import { NextRequest, NextResponse } from "next/server"
import {
  DEMO_COOKIE,
  demoCookieOptions,
  demoTokenValid,
  resolveDemoProgramme,
  sealDemoUnlock,
} from "@/lib/challenges/demo-unlock"
import { challengeById } from "@/lib/challenges/catalog"

export const dynamic = "force-dynamic"

/**
 * GET /api/demo/unlock?t=SECRET&programme=ai-safety-berlin&mode=solo
 *
 * Sets a signed cookie and sends the browser to that programme. Default
 * programme is AI Safety Berlin; default mode is solo (hide Recoding Medicine
 * for this browser so a partner pitch stays focused).
 */
export async function GET(req: NextRequest): Promise<Response> {
  const token = req.nextUrl.searchParams.get("t") ?? req.nextUrl.searchParams.get("token")
  if (!demoTokenValid(token)) {
    return NextResponse.json({ error: "invalid demo link" }, { status: 401 })
  }

  const programme =
    resolveDemoProgramme(req.nextUrl.searchParams.get("programme")) ??
    resolveDemoProgramme("ai-safety-berlin")
  if (!programme) {
    return NextResponse.json({ error: "unknown programme" }, { status: 400 })
  }

  const mode = req.nextUrl.searchParams.get("mode")
  const solo = mode !== "also"
  const sealed = sealDemoUnlock({ programme, solo })
  if (!sealed) {
    return NextResponse.json({ error: "demo unlock is not configured" }, { status: 503 })
  }

  const nextRaw = req.nextUrl.searchParams.get("next")
  const next =
    nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//")
      ? nextRaw
      : `/challenges/${challengeById(programme).slug}`

  const res = NextResponse.redirect(new URL(next, req.nextUrl.origin), 303)
  const opts = demoCookieOptions(sealed)
  res.cookies.set(DEMO_COOKIE, opts.value, {
    httpOnly: opts.httpOnly,
    sameSite: opts.sameSite,
    secure: opts.secure,
    path: opts.path,
    maxAge: opts.maxAge,
  })
  return res
}
