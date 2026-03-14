import { randomUUID } from 'node:crypto'
import type {
  DeleteServerProfileInput,
  ServerProfile,
  UpsertServerProfileInput
} from '../../shared/ipc'
import { getDatabase } from './database'

type ServerProfileRow = {
  id: string
  name: string
  transport_type: 'stdio' | 'sse'
  command: string
  args_json: string
  cwd: string
  url: string | null
  headers_json: string | null
  created_at: string
  updated_at: string
}

function toServerProfile(row: ServerProfileRow): ServerProfile {
  if (row.transport_type === 'sse') {
    return {
      id: row.id,
      name: row.name,
      transport: 'sse',
      url: row.url ?? '',
      headers:
        row.headers_json !== null ? (JSON.parse(row.headers_json) as Record<string, string>) : {},
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  return {
    id: row.id,
    name: row.name,
    transport: 'stdio',
    command: row.command,
    args: JSON.parse(row.args_json) as string[],
    ...(row.cwd.length > 0 ? { cwd: row.cwd } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function normalizeInput(input: UpsertServerProfileInput): UpsertServerProfileInput {
  const trimmedCwd = input.transport === 'stdio' ? input.cwd?.trim() : undefined

  const normalized: UpsertServerProfileInput =
    input.transport === 'stdio'
      ? {
          name: input.name.trim(),
          transport: 'stdio',
          command: input.command.trim(),
          args: input.args.map((arg) => arg.trim()).filter((arg) => arg.length > 0),
          ...(trimmedCwd !== undefined && trimmedCwd.length > 0 ? { cwd: trimmedCwd } : {})
        }
      : {
          name: input.name.trim(),
          transport: 'sse',
          url: input.url.trim(),
          headers: Object.fromEntries(
            Object.entries(input.headers ?? {}).map(([key, value]) => [key.trim(), value.trim()])
          )
        }

  if (input.id !== undefined) {
    normalized.id = input.id
  }

  return normalized
}

function ensureValidInput(input: UpsertServerProfileInput): void {
  if (input.name.length === 0) {
    throw new Error('Server profile name is required')
  }

  if (input.transport === 'stdio') {
    if (input.command.length === 0) {
      throw new Error('Server profile command is required')
    }

    return
  }

  if (input.url.length === 0) {
    throw new Error('SSE profile URL is required')
  }

  try {
    const parsed = new URL(input.url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('SSE profile URL must use http or https')
    }
  } catch {
    throw new Error('SSE profile URL must be valid')
  }
}

export function listServerProfiles(): ServerProfile[] {
  const db = getDatabase()
  const rows = db
    .prepare(
      `
      SELECT id, name, command, args_json, cwd, created_at, updated_at
      , transport_type, url, headers_json
      FROM server_profiles
      ORDER BY updated_at DESC
      `
    )
    .all() as ServerProfileRow[]

  return rows.map((row) => toServerProfile(row))
}

export function upsertServerProfile(rawInput: UpsertServerProfileInput): ServerProfile {
  const input = normalizeInput(rawInput)
  ensureValidInput(input)

  const db = getDatabase()
  const now = new Date().toISOString()
  const id = input.id ?? randomUUID()

  const existing = db.prepare('SELECT created_at FROM server_profiles WHERE id = ?').get(id) as
    | { created_at: string }
    | undefined

  const createdAt = existing?.created_at ?? now

  db.prepare(
    `
    INSERT INTO server_profiles (
      id,
      name,
      transport_type,
      command,
      args_json,
      cwd,
      url,
      headers_json,
      created_at,
      updated_at
    )
    VALUES (
      @id,
      @name,
      @transportType,
      @command,
      @argsJson,
      @cwd,
      @url,
      @headersJson,
      @createdAt,
      @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      transport_type = excluded.transport_type,
      command = excluded.command,
      args_json = excluded.args_json,
      cwd = excluded.cwd,
      url = excluded.url,
      headers_json = excluded.headers_json,
      updated_at = excluded.updated_at
    `
  ).run({
    id,
    name: input.name,
    transportType: input.transport,
    command: input.transport === 'stdio' ? input.command : 'sse',
    argsJson: JSON.stringify(input.transport === 'stdio' ? input.args : []),
    cwd: input.transport === 'stdio' ? (input.cwd ?? '') : '',
    url: input.transport === 'sse' ? input.url : null,
    headersJson: input.transport === 'sse' ? JSON.stringify(input.headers ?? {}) : null,
    createdAt,
    updatedAt: now
  })

  const row = db
    .prepare(
      `
      SELECT id, name, command, args_json, cwd, created_at, updated_at
      , transport_type, url, headers_json
      FROM server_profiles
      WHERE id = ?
      `
    )
    .get(id) as ServerProfileRow

  return toServerProfile(row)
}

export function deleteServerProfile(input: DeleteServerProfileInput): { ok: true } {
  const db = getDatabase()

  db.prepare('DELETE FROM server_profiles WHERE id = ?').run(input.id)

  return { ok: true }
}
