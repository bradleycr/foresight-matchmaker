import { NextRequest, NextResponse } from "next/server"
import { recordMailOptOut } from "@/lib/mail/optout-store"
import { decodeMailOptOutToken } from "@/lib/mail/unsubscribe-token"
import { recordNudgeOptOut } from "@/lib/nudge/store"

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
    <p style="font-family:Helvetica,Arial,sans-serif;font-size:0.875rem;line-height:1.5;margin-top:1.5rem;">
      <a href="https://foresightmatchmaker.app/account#email" style="color:${TEAL};">Account settings — turn programme emails back on</a>
    </p>
  </main>
</body>
</html>`
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
  })
}

async function stopFromToken(token: string | null): Promise<NextResponse> {
  const email = decodeMailOptOutToken(token)
  if (!email) {
    return page("This link is not valid", "Open Account settings to change email preferences, or reply to the email.", 400)
  }
  try {
    await recordMailOptOut(email, "unsubscribe_link")
    // Keep listing-reminder suppression in sync so we do not keep a second drip alive.
    await recordNudgeOptOut(email)
  } catch (error) {
    console.error("[mail] opt-out failed", error)
    return page("Could not save that", "Try the link again in a moment, or reply to the email.", 503)
  }
  return page(
    "Emails stopped",
    "You will not get programme announcements or thank-you mail from Foresight Matchmaking. Sign-in links still work if you need to open your profile.",
  )
}

/** Inbox unsubscribe link. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  return stopFromToken(req.nextUrl.searchParams.get("t"))
}

/** Gmail / RFC 8058 one-click unsubscribe. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  return stopFromToken(req.nextUrl.searchParams.get("t"))
}
