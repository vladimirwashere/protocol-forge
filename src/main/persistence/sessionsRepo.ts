import { getDatabase } from './database'

type SessionRow = {
  id: string
  transport_type: 'stdio' | 'sse'
  command: string
  args_json: string
  cwd: string
  env_json: string
  status: string
  error_text: string | null
  connected_at: string
  disconnected_at: string | null
}

export type SessionRecord = {
  id: string
  transportType: 'stdio' | 'sse'
  command: string
  args: string[]
  cwd: string
  env: Record<string, string>
  status: string
  errorText: string | null
  connectedAt: string
  disconnectedAt: string | null
}

type SessionSummaryRow = {
  id: string
  transport_type: 'stdio' | 'sse'
  status: string
  error_text: string | null
  connected_at: string
  disconnected_at: string | null
  message_count: number
}

export type SessionSummaryRecord = {
  sessionId: string
  transport: 'stdio' | 'sse'
  state: string
  error: string | null
  connectedAt: string
  disconnectedAt: string | null
  messageCount: number
}

type MessageRow = {
  id: number
  session_id: string
  direction: 'outbound' | 'inbound'
  payload_json: string
  created_at: string
}

export type SessionMessageRecord = {
  id: number
  sessionId: string
  direction: 'outbound' | 'inbound'
  payload: unknown
  createdAt: string
}

function mapSessionRow(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    transportType: row.transport_type,
    command: row.command,
    args: JSON.parse(row.args_json) as string[],
    cwd: row.cwd,
    env: JSON.parse(row.env_json) as Record<string, string>,
    status: row.status,
    errorText: row.error_text,
    connectedAt: row.connected_at,
    disconnectedAt: row.disconnected_at
  }
}

export function insertSessionRecord(input: {
  id: string
  command: string
  args: string[]
  cwd: string
  env: Record<string, string>
  status: string
  connectedAt: string
}): void {
  const db = getDatabase()

  db.prepare(
    `
    INSERT INTO sessions (
      id,
      transport_type,
      command,
      args_json,
      cwd,
      env_json,
      status,
      connected_at
    ) VALUES (
      @id,
      @transportType,
      @command,
      @argsJson,
      @cwd,
      @envJson,
      @status,
      @connectedAt
    )
    `
  ).run({
    id: input.id,
    transportType: 'stdio',
    command: input.command,
    argsJson: JSON.stringify(input.args),
    cwd: input.cwd,
    envJson: JSON.stringify(input.env),
    status: input.status,
    connectedAt: input.connectedAt
  })
}

export function updateSessionRecord(
  sessionId: string,
  status: string,
  options?: { disconnectedAt?: string; errorText?: string | null }
): void {
  const db = getDatabase()

  db.prepare(
    `
    UPDATE sessions
    SET
      status = @status,
      disconnected_at = COALESCE(@disconnectedAt, disconnected_at),
      error_text = COALESCE(@errorText, error_text)
    WHERE id = @sessionId
    `
  ).run({
    sessionId,
    status,
    disconnectedAt: options?.disconnectedAt,
    errorText: options?.errorText
  })
}

export function getSessionRecord(sessionId: string): SessionRecord | null {
  const db = getDatabase()

  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as
    | SessionRow
    | undefined

  return row ? mapSessionRow(row) : null
}

export function insertSessionMessage(input: {
  sessionId: string
  direction: 'outbound' | 'inbound'
  payloadJson: string
  createdAt: string
}): number {
  const db = getDatabase()

  const result = db
    .prepare(
    `
    INSERT INTO messages (session_id, direction, payload_json, created_at)
    VALUES (@sessionId, @direction, @payloadJson, @createdAt)
    `
    )
    .run(input)

  return Number(result.lastInsertRowid)
}

export function countSessionMessages(sessionId: string): number {
  const db = getDatabase()

  const row = db
    .prepare('SELECT COUNT(*) AS count FROM messages WHERE session_id = ?')
    .get(sessionId) as {
    count: number
  }

  return row.count
}

function parsePayload(payloadJson: string): unknown {
  try {
    return JSON.parse(payloadJson)
  } catch {
    return payloadJson
  }
}

export function listSessionMessages(sessionId: string, limit = 100): SessionMessageRecord[] {
  const db = getDatabase()

  const rows = db
    .prepare(
      `
      SELECT id, session_id, direction, payload_json, created_at
      FROM messages
      WHERE session_id = @sessionId
      ORDER BY id DESC
      LIMIT @limit
      `
    )
    .all({
      sessionId,
      limit: Math.max(1, Math.min(500, Math.floor(limit)))
    }) as MessageRow[]

  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    direction: row.direction,
    payload: parsePayload(row.payload_json),
    createdAt: row.created_at
  }))
}

export function listSessionSummaries(limit = 25): SessionSummaryRecord[] {
  const db = getDatabase()

  const rows = db
    .prepare(
      `
      SELECT
        s.id,
        s.transport_type,
        s.status,
        s.error_text,
        s.connected_at,
        s.disconnected_at,
        COUNT(m.id) AS message_count
      FROM sessions s
      LEFT JOIN messages m ON m.session_id = s.id
      GROUP BY s.id
      ORDER BY s.connected_at DESC
      LIMIT @limit
      `
    )
    .all({
      limit: Math.max(1, Math.min(100, Math.floor(limit)))
    }) as SessionSummaryRow[]

  return rows.map((row) => ({
    sessionId: row.id,
    transport: row.transport_type,
    state: row.status,
    error: row.error_text,
    connectedAt: row.connected_at,
    disconnectedAt: row.disconnected_at,
    messageCount: row.message_count
  }))
}
