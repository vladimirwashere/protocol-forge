import { describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import * as migration from '../src/main/persistence/migrations/0002_migrate_legacy_sse_profiles'

type ProfileRow = { id: string; transport_type: string; command: string }
type SessionRow = { id: string; transport_type: string }

type RunResult = { changes: number; lastInsertRowid: number }

function createFakeDb(
  profiles: ProfileRow[],
  sessions: SessionRow[]
): {
  db: Database.Database
  profiles: ProfileRow[]
  sessions: SessionRow[]
} {
  const prepare = (sql: string): unknown => {
    const normalized = sql.replace(/\s+/g, ' ').trim()

    if (normalized.startsWith("UPDATE server_profiles SET transport_type = 'streamable-http'")) {
      return {
        all: () => [],
        get: () => undefined,
        run: (): RunResult => {
          let changes = 0
          for (const row of profiles) {
            if (row.transport_type === 'sse') {
              row.transport_type = 'streamable-http'
              row.command = 'streamable-http'
              changes += 1
            }
          }
          return { changes, lastInsertRowid: 0 }
        }
      }
    }

    if (normalized.startsWith("UPDATE sessions SET transport_type = 'streamable-http'")) {
      return {
        all: () => [],
        get: () => undefined,
        run: (): RunResult => {
          let changes = 0
          for (const row of sessions) {
            if (row.transport_type === 'sse') {
              row.transport_type = 'streamable-http'
              changes += 1
            }
          }
          return { changes, lastInsertRowid: 0 }
        }
      }
    }

    throw new Error(`unexpected sql: ${normalized}`)
  }

  return {
    db: { prepare } as unknown as Database.Database,
    profiles,
    sessions
  }
}

describe('migration 0002: migrate_legacy_sse_profiles', () => {
  it('has the expected id and name', () => {
    expect(migration.id).toBe(2)
    expect(migration.name).toBe('migrate_legacy_sse_profiles')
  })

  it('rewrites sse server profiles and sessions to streamable-http', () => {
    const { db, profiles, sessions } = createFakeDb(
      [
        { id: 'p1', transport_type: 'sse', command: 'sse' },
        { id: 'p2', transport_type: 'streamable-http', command: 'streamable-http' },
        { id: 'p3', transport_type: 'stdio', command: 'node' }
      ],
      [
        { id: 's1', transport_type: 'sse' },
        { id: 's2', transport_type: 'stdio' }
      ]
    )

    migration.up(db)

    expect(profiles.find((p) => p.id === 'p1')).toEqual({
      id: 'p1',
      transport_type: 'streamable-http',
      command: 'streamable-http'
    })
    expect(profiles.find((p) => p.id === 'p2')?.transport_type).toBe('streamable-http')
    expect(profiles.find((p) => p.id === 'p3')?.transport_type).toBe('stdio')

    expect(sessions.find((s) => s.id === 's1')?.transport_type).toBe('streamable-http')
    expect(sessions.find((s) => s.id === 's2')?.transport_type).toBe('stdio')
  })

  it('is a no-op when no sse rows exist', () => {
    const { db, profiles, sessions } = createFakeDb(
      [{ id: 'p1', transport_type: 'stdio', command: 'node' }],
      [{ id: 's1', transport_type: 'streamable-http' }]
    )

    migration.up(db)

    expect(profiles[0].transport_type).toBe('stdio')
    expect(sessions[0].transport_type).toBe('streamable-http')
  })
})
