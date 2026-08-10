import { ok } from "@/lib/api/respond"
import { destroySession } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

/** POST /api/v1/auth/logout — clear the session cookie. */
export async function POST(): Promise<Response> {
  await destroySession()
  return ok({ signed_out: true })
}
