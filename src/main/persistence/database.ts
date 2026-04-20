import { app } from 'electron'
import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { canEncrypt, encryptString } from '../security/safe-storage'

let db: Database.Database | null = null
let linuxKeystoreWarningLogged = false

function addColumnIfMissing(db: Database.Database, table: string, definition: string): void {
  const columnName = definition.split(' ')[0]
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`)
  }
}

function openDatabase(): Database.Database {
  const userDataDir = app.getPath('userData')
  mkdirSync(userDataDir, { recursive: true })

  const dbPath = join(userDataDir, 'protocol-forge.db')
  const instance = new Database(dbPath)

  instance.pragma('journal_mode = WAL')
  instance.pragma('foreign_keys = ON')
  instance.exec(`
    CREATE TABLE IF NOT EXISTS server_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      transport_type TEXT NOT NULL DEFAULT 'stdio',
      command TEXT NOT NULL,
      args_json TEXT NOT NULL,
      cwd TEXT NOT NULL,
      url TEXT,
      headers_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      transport_type TEXT NOT NULL,
      server_profile_id TEXT,
      command TEXT NOT NULL,
      args_json TEXT NOT NULL,
      cwd TEXT NOT NULL,
      env_json TEXT NOT NULL,
      status TEXT NOT NULL,
      error_text TEXT,
      connected_at TEXT NOT NULL,
      disconnected_at TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      latency_ms REAL,
      is_error INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session_created_at
      ON messages(session_id, created_at);
  `)

  // Backfill older databases created before server profile transport expansion.
  addColumnIfMissing(instance, 'server_profiles', "transport_type TEXT NOT NULL DEFAULT 'stdio'")
  addColumnIfMissing(instance, 'server_profiles', 'url TEXT')
  addColumnIfMissing(instance, 'server_profiles', 'headers_json TEXT')
  addColumnIfMissing(instance, 'server_profiles', 'headers_enc BLOB')
  addColumnIfMissing(instance, 'sessions', 'server_profile_id TEXT')
  addColumnIfMissing(instance, 'messages', 'latency_ms REAL')
  addColumnIfMissing(instance, 'messages', 'is_error INTEGER NOT NULL DEFAULT 0')

  migratePlaintextHeaders(instance)
  reapOrphanedSessions(instance)

  return instance
}

export function reapOrphanedSessions(instance: Database.Database): void {
  instance
    .prepare(
      `
      UPDATE sessions
      SET status = 'disconnected',
          disconnected_at = COALESCE(disconnected_at, @now)
      WHERE status IN ('connecting', 'initializing', 'ready', 'disconnecting')
      `
    )
    .run({ now: new Date().toISOString() })
}

export function migratePlaintextHeaders(instance: Database.Database): void {
  if (!canEncrypt()) {
    const plaintextCount = (
      instance
        .prepare(
          `
          SELECT COUNT(*) AS count
          FROM server_profiles
          WHERE headers_json IS NOT NULL
            AND headers_enc IS NULL
            AND transport_type IN ('sse', 'streamable-http')
          `
        )
        .get() as { count: number }
    ).count

    if (plaintextCount > 0 && !linuxKeystoreWarningLogged) {
      linuxKeystoreWarningLogged = true
      console.warn(
        '[protocol-forge] OS keystore unavailable (safeStorage). SSE/Streamable HTTP profile headers remain in plaintext on disk.'
      )
    }

    return
  }

  const rows = instance
    .prepare(
      `
      SELECT id, headers_json
      FROM server_profiles
      WHERE headers_json IS NOT NULL
        AND headers_enc IS NULL
        AND transport_type IN ('sse', 'streamable-http')
      `
    )
    .all() as Array<{ id: string; headers_json: string }>

  if (rows.length === 0) {
    return
  }

  const update = instance.prepare(
    `
    UPDATE server_profiles
    SET headers_enc = @headersEnc,
        headers_json = NULL
    WHERE id = @id
    `
  )

  const runMigration = instance.transaction(
    (toMigrate: Array<{ id: string; headers_json: string }>) => {
      for (const row of toMigrate) {
        update.run({
          id: row.id,
          headersEnc: encryptString(row.headers_json)
        })
      }
    }
  )

  runMigration(rows)
}

export function getDatabase(): Database.Database {
  if (db === null) {
    db = openDatabase()
  }

  return db
}
