import { beforeEach, describe, expect, it, vi } from 'vitest'

type ProfileRow = {
  id: string
  name: string
  transport_type: string
  command: string
  args_json: string
  cwd: string
  url: string | null
  headers_json: string | null
  headers_enc: Buffer | null
  created_at: string
  updated_at: string
}

const state = vi.hoisted(() => ({
  rows: [] as ProfileRow[],
  canEncrypt: true
}))

vi.mock('../src/main/security/safe-storage', () => ({
  canEncrypt: () => state.canEncrypt,
  encryptString: (plain: string) => Buffer.from(`enc:${plain}`, 'utf8'),
  decryptString: (buf: Buffer) => {
    const str = buf.toString('utf8')
    if (!str.startsWith('enc:')) {
      throw new Error('decrypt failed')
    }
    return str.slice(4)
  }
}))

vi.mock('../src/main/persistence/database', () => ({
  getDatabase: () =>
    ({
      prepare: (sql: string) => {
        const normalized = sql.replace(/\s+/g, ' ').trim()

        if (normalized.startsWith('SELECT created_at FROM server_profiles WHERE id')) {
          return {
            get: (id: string) => state.rows.find((row) => row.id === id) ?? undefined,
            all: () => [],
            run: () => ({ changes: 0, lastInsertRowid: 0 })
          }
        }

        if (normalized.startsWith('SELECT id, name, command') && normalized.includes('ORDER BY')) {
          return {
            get: () => undefined,
            all: () => [...state.rows].sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
            run: () => ({ changes: 0, lastInsertRowid: 0 })
          }
        }

        if (normalized.startsWith('SELECT id, name, command') && normalized.includes('WHERE id')) {
          return {
            get: (id: string) => state.rows.find((row) => row.id === id),
            all: () => [],
            run: () => ({ changes: 0, lastInsertRowid: 0 })
          }
        }

        if (normalized.startsWith('INSERT INTO server_profiles')) {
          return {
            get: () => undefined,
            all: () => [],
            run: (params: Record<string, unknown>) => {
              const existingIdx = state.rows.findIndex((row) => row.id === params.id)
              const next: ProfileRow = {
                id: params.id as string,
                name: params.name as string,
                transport_type: params.transportType as string,
                command: params.command as string,
                args_json: params.argsJson as string,
                cwd: params.cwd as string,
                url: params.url as string | null,
                headers_json: params.headersJson as string | null,
                headers_enc: (params.headersEnc as Buffer | null) ?? null,
                created_at: params.createdAt as string,
                updated_at: params.updatedAt as string
              }
              if (existingIdx >= 0) {
                state.rows[existingIdx] = next
              } else {
                state.rows.push(next)
              }
              return { changes: 1, lastInsertRowid: 0 }
            }
          }
        }

        if (normalized.startsWith('DELETE FROM server_profiles')) {
          return {
            get: () => undefined,
            all: () => [],
            run: (id: string) => {
              state.rows = state.rows.filter((row) => row.id !== id)
              return { changes: 1, lastInsertRowid: 0 }
            }
          }
        }

        throw new Error(`unexpected sql: ${normalized}`)
      }
    }) as unknown as ReturnType<typeof import('better-sqlite3')>
}))

import {
  deleteServerProfile,
  listServerProfiles,
  upsertServerProfile
} from '../src/main/persistence/serverProfilesRepo'

describe('serverProfilesRepo', () => {
  beforeEach(() => {
    state.rows = []
    state.canEncrypt = true
  })

  it('round-trips a stdio profile', () => {
    const saved = upsertServerProfile({
      name: ' Stdio Server ',
      transport: 'stdio',
      command: 'node',
      args: ['server.js'],
      cwd: '/tmp'
    })

    expect(saved.name).toBe('Stdio Server')
    expect(saved.transport).toBe('stdio')

    const listed = listServerProfiles()
    expect(listed).toHaveLength(1)
    expect(listed[0].transport).toBe('stdio')
    if (listed[0].transport === 'stdio') {
      expect(listed[0].command).toBe('node')
      expect(listed[0].args).toEqual(['server.js'])
    }
  })

  it('round-trips a Streamable HTTP profile with encrypted headers', () => {
    const saved = upsertServerProfile({
      name: 'HTTP Server',
      transport: 'streamable-http',
      url: 'https://example.com/mcp',
      headers: { 'X-Token': 'secret' }
    })

    expect(saved.transport).toBe('streamable-http')
    expect(state.rows[0].headers_enc).not.toBeNull()
    expect(state.rows[0].headers_json).toBeNull()

    const reread = listServerProfiles()[0]
    if (reread.transport === 'streamable-http') {
      expect(reread.url).toBe('https://example.com/mcp')
      expect(reread.headers).toEqual({ 'X-Token': 'secret' })
    }
  })

  it('falls back to plaintext when encryption is unavailable', () => {
    state.canEncrypt = false

    upsertServerProfile({
      name: 'No Keystore',
      transport: 'streamable-http',
      url: 'https://example.com/mcp',
      headers: { Authorization: 'Bearer plain' }
    })

    expect(state.rows[0].headers_enc).toBeNull()
    expect(state.rows[0].headers_json).toBe('{"Authorization":"Bearer plain"}')

    const reread = listServerProfiles()[0]
    if (reread.transport === 'streamable-http') {
      expect(reread.headers).toEqual({ Authorization: 'Bearer plain' })
    }
  })

  it('rejects invalid Streamable HTTP URL', () => {
    expect(() =>
      upsertServerProfile({
        name: 'Bad',
        transport: 'streamable-http',
        url: 'not-a-url'
      })
    ).toThrow(/URL must be valid/)
  })

  it('still reads legacy SSE profiles for migration flows', () => {
    state.rows.push({
      id: 'legacy-sse-1',
      name: 'Legacy SSE',
      transport_type: 'sse',
      command: 'sse',
      args_json: '[]',
      cwd: '',
      url: 'https://example.com/mcp/sse',
      headers_json: null,
      headers_enc: Buffer.from('enc:{"Authorization":"Bearer token"}', 'utf8'),
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z'
    })

    const listed = listServerProfiles()
    expect(listed).toHaveLength(1)
    expect(listed[0].transport).toBe('sse')
  })

  it('deletes a profile by id', () => {
    const saved = upsertServerProfile({
      name: 'Temp',
      transport: 'stdio',
      command: 'node',
      args: [],
      cwd: ''
    })

    deleteServerProfile({ id: saved.id })
    expect(listServerProfiles()).toHaveLength(0)
  })
})
