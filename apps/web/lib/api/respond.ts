import { NextResponse } from "next/server"
import { ZodError } from "zod"

/** Uniform JSON envelopes for every /api/v1 handler. */

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data as unknown as Record<string, unknown>, init)
}

export function badRequest(message: string, details?: unknown): NextResponse {
  return NextResponse.json({ error: message, details }, { status: 400 })
}

export function unauthorized(message = "Sign in to do this."): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 })
}

export function forbidden(message = "You do not have access to this."): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 })
}

export function notFound(message = "Not found."): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 })
}

export function tooMany(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 429 })
}

export function gone(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 410 })
}

export function unavailable(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 503 })
}

export function zodError(error: ZodError): NextResponse {
  return badRequest(
    "Validation failed. Fix the listed fields and resubmit.",
    error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  )
}
