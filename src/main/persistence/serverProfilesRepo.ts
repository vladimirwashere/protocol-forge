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
  command: string
  args_json: string
  cwd: string
  created_at: string
  updated_at: string
}

function toServerProfile(row: ServerProfileRow): ServerProfile {
  return {
    id: row.id,
    name: row.name,
    command: row.command,
    args: JSON.parse(row.args_json) as string[],
    cwd: row.cwd,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function normalizeInput(input: UpsertServerProfileInput): UpsertServerProfileInput {
  const normalized: UpsertServerProfileInput = {
    name: input.name.trim(),
    command: input.command.trim(),
    args: input.args.map((arg) => arg.trim()).filter((arg) => arg.length > 0),
    cwd: input.cwd.trim()
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

  if (input.command.length === 0) {
    throw new Error('Server profile command is required')
  }

  if (input.cwd.length === 0) {
    throw new Error('Server profile cwd is required')
  }
}

export function listServerProfiles(): ServerProfile[] {
  const db = getDatabase()
  const rows = db
    .prepare(
      `
      SELECT id, name, command, args_json, cwd, created_at, updated_at
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
    INSERT INTO server_profiles (id, name, command, args_json, cwd, created_at, updated_at)
    VALUES (@id, @name, @command, @argsJson, @cwd, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      command = excluded.command,
      args_json = excluded.args_json,
      cwd = excluded.cwd,
      updated_at = excluded.updated_at
    `
  ).run({
    id,
    name: input.name,
    command: input.command,
    argsJson: JSON.stringify(input.args),
    cwd: input.cwd,
    createdAt,
    updatedAt: now
  })

  const row = db
    .prepare(
      `
      SELECT id, name, command, args_json, cwd, created_at, updated_at
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
