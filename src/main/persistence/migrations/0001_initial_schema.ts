import type Database from 'better-sqlite3'
import { addColumnIfMissing } from './helpers'

export const id = 1
export const name = 'initial_schema'

export function up(db: Database.Database): void {
  db.exec(`
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

  // Reconcile schema for databases created before column additions shipped.
  // Only relevant on first migration run; later migrations run exactly once
  // and can use plain DDL.
  addColumnIfMissing(db, 'server_profiles', "transport_type TEXT NOT NULL DEFAULT 'stdio'")
  addColumnIfMissing(db, 'server_profiles', 'url TEXT')
  addColumnIfMissing(db, 'server_profiles', 'headers_json TEXT')
  addColumnIfMissing(db, 'server_profiles', 'headers_enc BLOB')
  addColumnIfMissing(db, 'sessions', 'server_profile_id TEXT')
  addColumnIfMissing(db, 'messages', 'latency_ms REAL')
  addColumnIfMissing(db, 'messages', 'is_error INTEGER NOT NULL DEFAULT 0')
}
