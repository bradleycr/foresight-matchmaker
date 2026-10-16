import { NextRequest, NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { badRequest, forbidden, unavailable, zodError } from "@/lib/api/respond"
import { isAdmin } from "@/lib/auth/admin"
import { mailConfigured } from "@/lib/auth/mail"
import { durableEnabled } from "@/lib/db/durable-store"
import { planThankYouBlast, sendThankYouBlast } from "@/lib/mail/thank-you"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * POST /api/admin/mail/thank-you
 *
 *   { "mode": "dry_run" }                         — counts only
 *   { "mode": "test", "email": "you@example.org" } — one message
 *   { "mode": "send" }                            — full blast (explicit only)
 *
 * Never prints recipient lists in the response.
 */
const bodySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("dry_run") }),
  z.object({
    mode: z.literal("test"),
    email: z.string().email(),
  }),
  z.object({
    mode: z.literal("send"),
    confirm: z.literal("SEND_THANK_YOU_BLAST"),
  }),
])

export async function POST(req: NextRequest): Promise<Response> {
  if (!(await isAdmin())) return forbidden("Admin access required.")
  if (!mailConfigured()) return unavailable("Mail is not configured.")
  if (!durableEnabled()) return unavailable("Durable storage is required.")

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest("Request body must be JSON.")
  }

  let input: z.infer<typeof bodySchema>
  try {
    input = bodySchema.parse(body)
  } catch (error) {
    if (error instanceof ZodError) return zodError(error)
    throw error
  }

  if (input.mode === "dry_run") {
    const { plan } = await planThankYouBlast()
    return NextResponse.json({ ok: true, mode: "dry_run", plan })
  }

  if (input.mode === "test") {
    const result = await sendThankYouBlast({
      emails: [input.email],
      limit: 1,
    })
    return NextResponse.json({
      ok: true,
      mode: "test",
      sent: result.sent,
      failed: result.failed,
      attempted: result.attempted,
      stopped: result.stopped,
      plan: result.plan,
    })
  }

  const result = await sendThankYouBlast({ dryRun: false })
  return NextResponse.json({
    ok: true,
    mode: "send",
    sent: result.sent,
    failed: result.failed,
    attempted: result.attempted,
    stopped: result.stopped,
    plan: result.plan,
  })
}

/** GET — dry-run counts for a quick admin check. */
export async function GET(): Promise<Response> {
  if (!(await isAdmin())) return forbidden("Admin access required.")
  if (!durableEnabled()) return unavailable("Durable storage is required.")
  const { plan } = await planThankYouBlast()
  return NextResponse.json({ ok: true, mode: "dry_run", plan })
}
