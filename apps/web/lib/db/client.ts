import Database from "better-sqlite3"
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import fs from "node:fs"
import path from "node:path"
import * as tables from "./schema"

/**
 * SQLite connection, resolved once per process.
 *
 * The DB file lives at <repo root>/data/app.db (gitignored) unless
 * DATABASE_PATH overrides it — which is what the Docker image does to point
 * at the mounted volume. The repo root is found by walking up from cwd to
 * the pnpm workspace file, so `next dev` (cwd = apps/web) and the Docker
 * runtime (cwd = /app) both land on the same file layout.
 */
function resolveDatabasePath(): string {
  if (process.env.DATABASE_PATH) return process.env.DATABASE_PATH

  // Vercel’s filesystem is ephemeral — keep the SQLite file under /tmp so
  // writes succeed. Data does not survive cold starts; fine for a smoke demo,
  // not for durable production (use the Docker/VM path for that).
  if (process.env.VERCEL) return "/tmp/rmm-app.db"

  let dir = process.cwd()
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) break
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return path.join(dir, "data", "app.db")
}

/**
 * Idempotent bootstrap migrations. Every statement is CREATE-IF-NOT-EXISTS,
 * so opening the DB is always safe — fresh disk, existing data, or a volume
 * mounted into a brand-new container.
 */
const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS profiles (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  kind          TEXT NOT NULL,
  org_name      TEXT NOT NULL,
  org_type      TEXT NOT NULL,
  country       TEXT NOT NULL,
  visibility    TEXT NOT NULL DEFAULT 'public',
  application_status TEXT NOT NULL,
  completeness  INTEGER NOT NULL DEFAULT 0,
  contact_email TEXT NOT NULL,
  joint_application TEXT,
  data          TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  claimed_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_profiles_kind ON profiles(kind);
CREATE INDEX IF NOT EXISTS idx_profiles_contact_email ON profiles(contact_email);

CREATE TABLE IF NOT EXISTS matches (
  subject_id  TEXT NOT NULL,
  other_id    TEXT NOT NULL,
  score       INTEGER NOT NULL,
  factors     TEXT NOT NULL,
  blockers    TEXT NOT NULL,
  computed_at TEXT NOT NULL,
  PRIMARY KEY (subject_id, other_id)
);
CREATE INDEX IF NOT EXISTS idx_matches_subject ON matches(subject_id, score);

CREATE TABLE IF NOT EXISTS intros (
  id             TEXT PRIMARY KEY,
  from_id        TEXT NOT NULL,
  to_id          TEXT NOT NULL,
  message        TEXT NOT NULL,
  state          TEXT NOT NULL DEFAULT 'requested',
  decline_reason TEXT,
  created_at     TEXT NOT NULL,
  responded_at   TEXT,
  expires_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_intros_to ON intros(to_id);
CREATE INDEX IF NOT EXISTS idx_intros_from ON intros(from_id);

CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  profile_id TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at    TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type       TEXT NOT NULL,
  actor_id   TEXT,
  payload    TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
`

type Db = BetterSQLite3Database<typeof tables>

declare global {
  // Cached across HMR reloads in dev so we don't leak file handles.
  var __rmmDb: { db: Db; sqlite: Database.Database } | undefined
}

function open(): { db: Db; sqlite: Database.Database } {
  const file = resolveDatabasePath()
  fs.mkdirSync(path.dirname(file), { recursive: true })

  const sqlite = new Database(file)
  sqlite.pragma("journal_mode = WAL")
  sqlite.pragma("foreign_keys = ON")
  sqlite.exec(MIGRATIONS)

  return { db: drizzle(sqlite, { schema: tables }), sqlite }
}

export function getDb(): Db {
  if (!globalThis.__rmmDb) globalThis.__rmmDb = open()
  return globalThis.__rmmDb.db
}
