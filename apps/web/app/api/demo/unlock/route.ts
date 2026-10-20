import { NextRequest, NextResponse } from "next/server"
import {
  DEMO_COOKIE,
  demoCookieOptions,
  demoTokenValid,
  resolveDemoProgramme,
  sealDemoUnlock,
} from "@/lib/challenges/demo-unlock"
import { challengeById } from "@/lib/challenges/catalog"
import { previewEnabled } from "@/lib/challenges/visibility"

export const dynamic = "force-dynamic"

/**
 * GET /api/demo/unlock?t=SECRET&programme=ai-safety-berlin&mode=solo
 *
 * Sets a signed cookie and sends the browser to that programme — only on
 * desks where preview programmes are enabled (local / pitch deploy). On
 * production (previews off) the link refuses so the live app never gains
 * an AI Safety Berlin cookie that would hide Recoding Medicine.
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

  if (!previewEnabled(programme)) {
    return NextResponse.json(
      { error: "preview programmes are off on this deployment" },
      { status: 404 },
    )
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
