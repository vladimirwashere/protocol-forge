import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ canEncrypt: true }))

vi.mock('../src/main/security/safe-storage', () => ({
  canEncrypt: () => state.canEncrypt,
  encryptString: (plain: string) => Buffer.from(`enc:${plain}`, 'utf8'),
  decryptString: (buf: Buffer) => buf.toString('utf8').replace(/^enc:/, '')
}))

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/protocol-forge-test'
  }
}))

import { migratePlaintextHeaders } from '../src/main/persistence/database'

type Row = {
  id: string
  transport_type: 'stdio' | 'sse' | 'streamable-http'
  headers_json: string | null
  headers_enc: Buffer | null
}

function isUrlTransport(t: Row['transport_type']): boolean {
  return t === 'sse' || t === 'streamable-http'
}

function createFakeDb(initial: Row[]): {
  prepare: (sql: string) => {
    all: (params?: unknown) => unknown
    get: (params?: unknown) => unknown
    run: (params?: unknown) => { changes: number; lastInsertRowid: number }
  }
  transaction: <T>(fn: (input: T) => void) => (input: T) => void
  rows: Row[]
} {
  const rows = [...initial]

  const prepare = (
    sql: string
  ): {
    all: (params?: unknown) => unknown
    get: (params?: unknown) => unknown
    run: (params?: unknown) => { changes: number; lastInsertRowid: number }
  } => {
    const normalized = sql.replace(/\s+/g, ' ').trim()

    if (normalized.startsWith('SELECT COUNT(*)')) {
      return {
        all: () => [],
        get: () => ({
          count: rows.filter(
            (r) =>
              r.headers_json !== null && r.headers_enc === null && isUrlTransport(r.transport_type)
          ).length
        }),
        run: () => ({ changes: 0, lastInsertRowid: 0 })
      }
    }

    if (normalized.startsWith('SELECT id, headers_json')) {
      return {
        all: () =>
          rows
            .filter(
              (r) =>
                r.headers_json !== null &&
                r.headers_enc === null &&
                isUrlTransport(r.transport_type)
            )
            .map((r) => ({ id: r.id, headers_json: r.headers_json })),
        get: () => undefined,
        run: () => ({ changes: 0, lastInsertRowid: 0 })
      }
    }

    if (normalized.startsWith('UPDATE server_profiles')) {
      return {
        all: () => [],
        get: () => undefined,
        run: (params?: unknown) => {
          const p = params as { id: string; headersEnc: Buffer }
          const row = rows.find((r) => r.id === p.id)
          if (row) {
            row.headers_enc = p.headersEnc
            row.headers_json = null
          }
          return { changes: row ? 1 : 0, lastInsertRowid: 0 }
        }
      }
    }

    throw new Error(`unexpected sql: ${normalized}`)
  }

  const transaction = <T>(fn: (input: T) => void): ((input: T) => void) => {
    return (input: T) => fn(input)
  }

  return { prepare, transaction, rows }
}

describe('migratePlaintextHeaders', () => {
  beforeEach(() => {
    state.canEncrypt = true
  })

  it('encrypts existing plaintext headers for SSE and Streamable HTTP profiles', () => {
    const db = createFakeDb([
      {
        id: 'sse-1',
        transport_type: 'sse',
        headers_json: JSON.stringify({ Authorization: 'Bearer sse' }),
        headers_enc: null
      },
      {
        id: 'http-1',
        transport_type: 'streamable-http',
        headers_json: JSON.stringify({ 'X-Token': 'secret' }),
        headers_enc: null
      },
      {
        id: 'stdio-1',
        transport_type: 'stdio',
        headers_json: null,
        headers_enc: null
      }
    ])

    migratePlaintextHeaders(db as unknown as import('better-sqlite3').Database)

    const sse = db.rows.find((r) => r.id === 'sse-1')!
    expect(sse.headers_json).toBeNull()
    expect(sse.headers_enc!.toString('utf8')).toBe('enc:{"Authorization":"Bearer sse"}')

    const http = db.rows.find((r) => r.id === 'http-1')!
    expect(http.headers_json).toBeNull()
    expect(http.headers_enc!.toString('utf8')).toBe('enc:{"X-Token":"secret"}')

    const stdio = db.rows.find((r) => r.id === 'stdio-1')!
    expect(stdio.headers_json).toBeNull()
    expect(stdio.headers_enc).toBeNull()
  })

  it('is idempotent on a second pass', () => {
    const db = createFakeDb([
      {
        id: 'sse-1',
        transport_type: 'sse',
        headers_json: JSON.stringify({ Authorization: 'Bearer sse' }),
        headers_enc: null
      }
    ])

    migratePlaintextHeaders(db as unknown as import('better-sqlite3').Database)
    const firstEnc = Buffer.from(db.rows[0].headers_enc!)

    migratePlaintextHeaders(db as unknown as import('better-sqlite3').Database)
    const secondEnc = db.rows[0].headers_enc!

    expect(secondEnc.equals(firstEnc)).toBe(true)
  })

  it('leaves plaintext in place when encryption is unavailable', () => {
    state.canEncrypt = false
    const db = createFakeDb([
      {
        id: 'sse-1',
        transport_type: 'sse',
        headers_json: JSON.stringify({ Authorization: 'Bearer sse' }),
        headers_enc: null
      }
    ])

    migratePlaintextHeaders(db as unknown as import('better-sqlite3').Database)

    expect(db.rows[0].headers_json).toBe(JSON.stringify({ Authorization: 'Bearer sse' }))
    expect(db.rows[0].headers_enc).toBeNull()
  })
})
