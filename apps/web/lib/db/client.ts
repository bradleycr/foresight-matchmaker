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
  // writes succeed. Listings and funnel events are dual-written to Supabase
  // (`lib/db/durable.ts`) so the next instance can refill this cache. The
  // Docker/VM path with a mounted `./data` volume does not need a remote store.
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
  visibility    TEXT NOT NULL DEFAULT 'authenticated_only',
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
  uid        TEXT UNIQUE,
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

/**
 * A database we cannot write to is the one failure that looks like a bug in
 * every other part of the app: the form 500s, the directory empties, and the
 * cause is three layers down in a native module. The usual culprit on a VM is
 * a bind-mounted `./data` owned by root while the container runs as `node`,
 * so name that explicitly rather than re-raising `SQLITE_CANTOPEN`.
 */
function openOrExplain(file: string): Database.Database {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    return new Database(file)
  } catch (cause) {
    throw new Error(
      [
        `[db] Cannot open the SQLite database at ${file}.`,
        "",
        "The directory must be writable by the user running the app.",
        "In Docker the volume is owned by the host, not the image, so:",
        "",
        `  chown -R 1000:1000 ${path.dirname(file)}`,
        "",
        "Nothing has been written — fix the permission and restart.",
      ].join("\n"),
      { cause },
    )
  }
}

/**
 * Databases created before events carried a Blob uid still open — add the
 * column in place. New files get `uid` from CREATE TABLE above.
 */
function ensureEventUid(sqlite: Database.Database): void {
  try {
    const cols = sqlite.pragma("table_info(events)") as { name?: string }[]
    const names = cols.map((c) => c.name)
    if (!names.includes("uid")) {
      sqlite.exec("ALTER TABLE events ADD COLUMN uid TEXT")
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!/duplicate column name/i.test(message)) throw error
  }
  try {
    sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_events_uid ON events(uid)")
  } catch (error) {
    console.error("[db] events uid index skipped", error)
  }
}

function open(): { db: Db; sqlite: Database.Database } {
  const file = resolveDatabasePath()
  const sqlite = openOrExplain(file)

  sqlite.pragma("journal_mode = WAL")
  // Wait for a lock instead of failing under a webinar burst of writes.
  sqlite.pragma("busy_timeout = 5000")
  // WAL defaults to synchronous=NORMAL, which does not fsync on commit: a host
  // power-cut or hard reset can drop the last few transactions. Every write
  // here is someone's profile typed in by hand, and the write rate is a few
  // per minute, so trade the unmeasurable throughput for a durable commit.
  sqlite.pragma("synchronous = FULL")
  sqlite.pragma("foreign_keys = ON")
  sqlite.exec(MIGRATIONS)
  ensureEventUid(sqlite)

  registerCheckpointOnShutdown(sqlite)

  return { db: drizzle(sqlite, { schema: tables }), sqlite }
}

/**
 * Fold the WAL back into the main file when the process stops.
 *
 * In WAL mode the recent history lives in `app.db-wal`, so a stopped container
 * can leave `app.db` almost empty. That is safe for SQLite — it recovers on
 * open — but it quietly breaks the most natural backup anyone will reach for
 * (`cp data/app.db`). Checkpointing on the way out means the single file is
 * always the whole database.
 */
function registerCheckpointOnShutdown(sqlite: Database.Database): void {
  const checkpoint = () => {
    try {
      sqlite.pragma("wal_checkpoint(TRUNCATE)")
    } catch {
      // Best effort. A busy checkpoint loses nothing: the WAL is still on disk
      // and SQLite replays it on the next open.
    }
  }

  process.once("SIGTERM", checkpoint)
  process.once("SIGINT", checkpoint)
  process.once("beforeExit", checkpoint)
}

export function getDb(): Db {
  if (!globalThis.__rmmDb) globalThis.__rmmDb = open()
  return globalThis.__rmmDb.db
}
