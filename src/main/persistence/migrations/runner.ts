import type Database from 'better-sqlite3'
import type { Migration } from './types'

const SCHEMA_MIGRATIONS_DDL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )
`

export function runMigrations(db: Database.Database, migrations: readonly Migration[]): void {
  db.exec(SCHEMA_MIGRATIONS_DDL)

  const appliedIds = new Set(
    (db.prepare('SELECT id FROM schema_migrations').all() as Array<{ id: number }>).map(
      (row) => row.id
    )
  )

  const ordered = [...migrations].sort((a, b) => a.id - b.id)
  const seen = new Set<number>()
  for (const migration of ordered) {
    if (seen.has(migration.id)) {
      throw new Error(`Duplicate migration id ${migration.id}`)
    }
    seen.add(migration.id)
  }

  const recordApplied = db.prepare(
    'INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)'
  )

  for (const migration of ordered) {
    if (appliedIds.has(migration.id)) {
      continue
    }
    const tx = db.transaction(() => {
      migration.up(db)
      recordApplied.run(migration.id, migration.name, new Date().toISOString())
    })
    tx()
  }
}
