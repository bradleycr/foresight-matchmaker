import { NextRequest } from "next/server"
import { ok } from "@/lib/api/respond"
import { getSession, touchSession } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

/**
 * GET /api/v1/auth/touch — slide the session cookie forward on activity.
 *
 * The session is httpOnly, so the client cannot read it; this route lets a
 * signed-in browser renew quietly without another magic link.
 */
export async function GET(_req: NextRequest): Promise<Response> {
  const session = await getSession()
  if (!session) return ok({ renewed: false })
  const renewed = await touchSession(session)
  return ok({ renewed })
}
