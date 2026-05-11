import type Database from 'better-sqlite3'

export const id = 2
export const name = 'migrate_legacy_sse_profiles'

export function up(db: Database.Database): void {
  db.prepare(
    `
    UPDATE server_profiles
    SET transport_type = 'streamable-http',
        command = 'streamable-http'
    WHERE transport_type = 'sse'
    `
  ).run()

  db.prepare(
    `
    UPDATE sessions
    SET transport_type = 'streamable-http'
    WHERE transport_type = 'sse'
    `
  ).run()
}
