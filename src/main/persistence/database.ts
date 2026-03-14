import { app } from 'electron'
import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

let db: Database.Database | null = null

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
  addColumnIfMissing(instance, 'sessions', 'server_profile_id TEXT')
  addColumnIfMissing(instance, 'messages', 'latency_ms REAL')
  addColumnIfMissing(instance, 'messages', 'is_error INTEGER NOT NULL DEFAULT 0')

  return instance
}

export function getDatabase(): Database.Database {
  if (db === null) {
    db = openDatabase()
  }

  return db
}
