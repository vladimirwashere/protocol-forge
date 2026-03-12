import { app } from 'electron'
import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

let db: Database.Database | null = null

function openDatabase(): Database.Database {
  const userDataDir = app.getPath('userData')
  mkdirSync(userDataDir, { recursive: true })

  const dbPath = join(userDataDir, 'mcp-scope.db')
  const instance = new Database(dbPath)

  instance.pragma('journal_mode = WAL')
  instance.exec(`
    CREATE TABLE IF NOT EXISTS server_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      command TEXT NOT NULL,
      args_json TEXT NOT NULL,
      cwd TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  return instance
}

export function getDatabase(): Database.Database {
  if (db === null) {
    db = openDatabase()
  }

  return db
}
