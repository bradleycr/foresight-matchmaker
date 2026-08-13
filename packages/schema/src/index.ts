/**
 * @rmm/schema — the single source of truth for Foresight Matchmaking
 * profile data. Recoding Medicine is the first programme (`challenge_id`).
 * Zero framework dependencies. Zod defines everything; TypeScript types
 * are inferred and JSON Schema is generated from these.
 */

export const SCHEMA_VERSION = "v1" as const

export * from "./enums"
export * from "./countries"
export * from "./dataset"
export * from "./profile"
export * from "./derive"
export * from "./finalize-golden"
