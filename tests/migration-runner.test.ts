import { describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { runMigrations } from '../src/main/persistence/migrations/runner'
import type { Migration } from '../src/main/persistence/migrations/types'

type AppliedRow = { id: number; name: string; applied_at: string }

type RunResult = { changes: number; lastInsertRowid: number }

function createFakeDb(initialApplied: AppliedRow[] = []): {
  db: Database.Database
  applied: AppliedRow[]
  execs: string[]
} {
  const applied: AppliedRow[] = [...initialApplied]
  const execs: string[] = []

  const prepare = (sql: string): unknown => {
    const normalized = sql.replace(/\s+/g, ' ').trim()

    if (normalized.startsWith('SELECT id FROM schema_migrations')) {
      return {
        all: () => applied.map((row) => ({ id: row.id })),
        get: () => undefined,
        run: () => ({ changes: 0, lastInsertRowid: 0 }) as RunResult
      }
    }

    if (normalized.startsWith('INSERT INTO schema_migrations')) {
      return {
        all: () => [],
        get: () => undefined,
        run: (id: number, name: string, appliedAt: string): RunResult => {
          applied.push({ id, name, applied_at: appliedAt })
          return { changes: 1, lastInsertRowid: id }
        }
      }
    }

    throw new Error(`unexpected prepare: ${normalized}`)
  }

  const transaction = <T>(fn: (input?: T) => void): ((input?: T) => void) => {
    return (input?: T) => fn(input)
  }

  const exec = (sql: string): void => {
    execs.push(sql.replace(/\s+/g, ' ').trim())
  }

  return {
    db: { prepare, transaction, exec } as unknown as Database.Database,
    applied,
    execs
  }
}

function makeMigration(id: number, name: string, sideEffect: (id: number) => void): Migration {
  return {
    id,
    name,
    up: () => sideEffect(id)
  }
}

describe('runMigrations', () => {
  it('applies all migrations on a fresh database', () => {
    const { db, applied } = createFakeDb()
    const ran: number[] = []
    const migrations = [
      makeMigration(1, 'one', (id) => ran.push(id)),
      makeMigration(2, 'two', (id) => ran.push(id))
    ]

    runMigrations(db, migrations)

    expect(ran).toEqual([1, 2])
    expect(applied.map((row) => row.id)).toEqual([1, 2])
    expect(applied.map((row) => row.name)).toEqual(['one', 'two'])
  })

  it('skips migrations that are already recorded as applied', () => {
    const { db, applied } = createFakeDb([
      { id: 1, name: 'one', applied_at: '2024-01-01T00:00:00.000Z' }
    ])
    const ran: number[] = []
    const migrations = [
      makeMigration(1, 'one', (id) => ran.push(id)),
      makeMigration(2, 'two', (id) => ran.push(id))
    ]

    runMigrations(db, migrations)

    expect(ran).toEqual([2])
    expect(applied.map((row) => row.id)).toEqual([1, 2])
  })

  it('is a no-op when every migration is already applied', () => {
    const { db, applied } = createFakeDb([
      { id: 1, name: 'one', applied_at: '2024-01-01T00:00:00.000Z' },
      { id: 2, name: 'two', applied_at: '2024-01-02T00:00:00.000Z' }
    ])
    const ran: number[] = []
    const migrations = [
      makeMigration(1, 'one', (id) => ran.push(id)),
      makeMigration(2, 'two', (id) => ran.push(id))
    ]

    runMigrations(db, migrations)

    expect(ran).toEqual([])
    expect(applied).toHaveLength(2)
  })

  it('applies migrations in id order regardless of input order', () => {
    const { db, applied } = createFakeDb()
    const ran: number[] = []
    const migrations = [
      makeMigration(3, 'three', (id) => ran.push(id)),
      makeMigration(1, 'one', (id) => ran.push(id)),
      makeMigration(2, 'two', (id) => ran.push(id))
    ]

    runMigrations(db, migrations)

    expect(ran).toEqual([1, 2, 3])
    expect(applied.map((row) => row.id)).toEqual([1, 2, 3])
  })

  it('rejects duplicate migration ids', () => {
    const { db } = createFakeDb()
    const migrations = [
      makeMigration(1, 'one', () => {}),
      makeMigration(1, 'one-duplicate', () => {})
    ]

    expect(() => runMigrations(db, migrations)).toThrow(/Duplicate migration id 1/)
  })

  it('ensures the schema_migrations table exists before reading applied ids', () => {
    const { db, execs } = createFakeDb()

    runMigrations(db, [])

    expect(
      execs.some((sql) => sql.startsWith('CREATE TABLE IF NOT EXISTS schema_migrations'))
    ).toBe(true)
  })
})
