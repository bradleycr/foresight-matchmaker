/**
 * @rmm/schema — the single source of truth for the Recoding Medicine
 * Matchmaker data model. Zero framework dependencies. Zod defines everything;
 * TypeScript types are inferred and JSON Schema is generated from these.
 */

export const SCHEMA_VERSION = "v1" as const

export * from "./enums.js"
export * from "./countries.js"
export * from "./dataset.js"
export * from "./profile.js"
export * from "./derive.js"
