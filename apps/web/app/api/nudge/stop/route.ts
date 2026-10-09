import { NextRequest, NextResponse } from "next/server"
import { recordNudgeOptOut } from "@/lib/nudge/store"
import { decodeStopToken } from "@/lib/nudge/token"

export const dynamic = "force-dynamic"

const PAPER = "#e5f0f6"
const INK = "#17150f"
const TEAL = "#1f7a74"

function page(title: string, body: string, status = 200): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
</head>
<body style="margin:0;background:${PAPER};color:${INK};font-family:Georgia,'Times New Roman',serif;">
  <main style="max-width:32rem;margin:4rem auto;padding:0 1.5rem;">
    <p style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${TEAL};">Foresight Matchmaking</p>
    <h1 style="font-weight:normal;font-size:2rem;letter-spacing:-0.02em;text-transform:uppercase;">${title}</h1>
    <p style="font-family:Helvetica,Arial,sans-serif;font-size:1rem;line-height:1.5;">${body}</p>
  </main>
</body>
</html>`
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
  })
}

async function stopFromToken(token: string | null): Promise<NextResponse> {
  const email = decodeStopToken(token)
  if (!email) {
    return page("This link is not valid", "Request a new sign-in link from Foresight Matchmaking if you still want a listing.", 400)
  }
  try {
    await recordNudgeOptOut(email)
  } catch (error) {
    console.error("[nudge] opt-out failed", error)
    return page("Could not save that", "Try the link again in a moment, or reply to the email.", 503)
  }
  return page("Reminders stopped", "You will not get another listing reminder from Foresight Matchmaking.")
}

/** Inbox “stop reminders” link. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  return stopFromToken(req.nextUrl.searchParams.get("t"))
}

/** Gmail / RFC 8058 one-click unsubscribe posts here. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  return stopFromToken(req.nextUrl.searchParams.get("t"))
}
