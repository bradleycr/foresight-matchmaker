import { NextRequest } from "next/server"
import { gone, unauthorized, notFound } from "@/lib/api/respond"
import { getSession } from "@/lib/auth/session"
import { getIntro } from "@/lib/db/intros"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

/**
 * PATCH /api/v1/intros/[id] — retired.
 *
 * Introductions are emailed immediately. There is nothing to accept or decline
 * on this platform; continue the conversation in the mail client.
 */
export async function PATCH(_req: NextRequest, { params }: Params): Promise<Response> {
  const session = await getSession()
  if (!session) return unauthorized()

  const { id } = await params
  const intro = getIntro(id)
  if (!intro) return notFound("No introduction with that id.")

  return gone("Introductions are sent by email. There is nothing to accept on this platform.")
}
