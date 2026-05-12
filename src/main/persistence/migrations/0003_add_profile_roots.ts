import type Database from 'better-sqlite3'

export const id = 3
export const name = 'add_profile_roots'

export function up(db: Database.Database): void {
  db.exec(`ALTER TABLE server_profiles ADD COLUMN roots_json TEXT`)
}
