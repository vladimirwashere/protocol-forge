import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { canEncrypt, encryptString } from '../security/safe-storage'
import { MIGRATIONS, runMigrations } from './migrations'

let db: Database.Database | null = null
let linuxKeystoreWarningLogged = false

export function initDatabase(userDataDir: string): Database.Database {
  if (db !== null) {
    return db
  }

  mkdirSync(userDataDir, { recursive: true })

  const dbPath = join(userDataDir, 'protocol-forge.db')
  const instance = new Database(dbPath)

  instance.pragma('journal_mode = WAL')
  instance.pragma('foreign_keys = ON')

  runMigrations(instance, MIGRATIONS)

  migratePlaintextHeaders(instance)
  reapOrphanedSessions(instance)

  db = instance
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
            AND transport_type = 'streamable-http'
          `
        )
        .get() as { count: number }
    ).count

    if (plaintextCount > 0 && !linuxKeystoreWarningLogged) {
      linuxKeystoreWarningLogged = true
      console.warn(
        '[protocol-forge] OS keystore unavailable (safeStorage). Streamable HTTP profile headers remain in plaintext on disk.'
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
        AND transport_type = 'streamable-http'
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
    throw new Error('Database not initialized; call initDatabase first')
  }

  return db
}
