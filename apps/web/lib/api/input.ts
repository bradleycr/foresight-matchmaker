import { z } from "zod"
import { dataHolderSchema, aiTeamSchema, consortiumSchema, individualSchema } from "@rmm/schema"

/**
 * Client-facing write schemas. These are the full profile schemas minus every
 * field the server owns: identity, slug, timestamps, and — critically — the
 * derived fields (`eligible_hq`, `completeness`), which are recomputed
 * server-side on every write and can never be asserted by a client.
 */

const SERVER_OWNED = {
  id: true,
  slug: true,
  eligible_hq: true,
  completeness: true,
  created_at: true,
  updated_at: true,
  claimed_at: true,
} as const

export const profileInputSchema = z.discriminatedUnion("kind", [
  dataHolderSchema.omit(SERVER_OWNED),
  aiTeamSchema.omit(SERVER_OWNED),
  consortiumSchema.omit(SERVER_OWNED),
  individualSchema.omit(SERVER_OWNED),
])

export type ProfileInput = z.infer<typeof profileInputSchema>

export const introRequestSchema = z.object({
  to_id: z.string().uuid(),
  message: z.string().min(1).max(500),
})

export const contactClickSchema = z.object({
  to_id: z.string().uuid(),
  channel: z.enum(["email", "linkedin"]),
})

export const introResponseSchema = z.object({
  action: z.enum(["accepted", "declined"]),
  decline_reason: z.enum(["wrong_domain", "governance_mismatch", "already_have_partner", "not_applying", "other"]).optional(),
})

export const requestLinkSchema = z.object({
  email: z.string().email(),
  next: z.string().max(200).optional(),
})

export const outcomeSchema = z.object({
  joint_application: z.enum(["yes", "no", "not_yet"]),
})
