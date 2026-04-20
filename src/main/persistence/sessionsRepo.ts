import type { SessionTransport } from '../../shared/ipc'
import { getDatabase } from './database'

type SessionRow = {
  id: string
  transport_type: SessionTransport
  server_profile_id: string | null
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
  transportType: SessionTransport
  serverProfileId: string | null
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
  transport_type: SessionTransport
  server_profile_id: string | null
  server_profile_name: string | null
  status: string
  error_text: string | null
  connected_at: string
  disconnected_at: string | null
  message_count: number
  avg_latency_ms: number | null
  error_count: number
}

export type SessionSummaryRecord = {
  sessionId: string
  transport: SessionTransport
  serverProfileId: string | null
  serverProfileName: string | null
  state: string
  error: string | null
  connectedAt: string
  disconnectedAt: string | null
  messageCount: number
  avgLatencyMs: number | null
  errorCount: number
}

export type SessionStatsRecord = {
  messageCount: number
  avgLatencyMs: number | null
  errorCount: number
}

type MessageRow = {
  id: number
  session_id: string
  direction: 'outbound' | 'inbound'
  payload_json: string
  latency_ms: number | null
  is_error: number
  created_at: string
}

export type SessionMessageRecord = {
  id: number
  sessionId: string
  direction: 'outbound' | 'inbound'
  payload: unknown
  createdAt: string
  latencyMs?: number
  isError?: boolean
}

function mapSessionRow(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    transportType: row.transport_type,
    serverProfileId: row.server_profile_id,
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
  transportType: SessionTransport
  serverProfileId?: string
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
      server_profile_id,
      command,
      args_json,
      cwd,
      env_json,
      status,
      connected_at
    ) VALUES (
      @id,
      @transportType,
      @serverProfileId,
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
    transportType: input.transportType,
    serverProfileId: input.serverProfileId ?? null,
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
  latencyMs?: number
  isError?: boolean
  createdAt: string
}): number {
  const db = getDatabase()

  const result = db
    .prepare(
      `
    INSERT INTO messages (session_id, direction, payload_json, latency_ms, is_error, created_at)
    VALUES (@sessionId, @direction, @payloadJson, @latencyMs, @isError, @createdAt)
    `
    )
    .run({
      sessionId: input.sessionId,
      direction: input.direction,
      payloadJson: input.payloadJson,
      latencyMs: input.latencyMs ?? null,
      isError: input.isError ? 1 : 0,
      createdAt: input.createdAt
    })

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

export function getSessionStats(sessionId: string): SessionStatsRecord {
  const db = getDatabase()

  const row = db
    .prepare(
      `
      SELECT
        COUNT(*) AS message_count,
        AVG(latency_ms) AS avg_latency_ms,
        SUM(CASE WHEN is_error = 1 THEN 1 ELSE 0 END) AS error_count
      FROM messages
      WHERE session_id = @sessionId
      `
    )
    .get({ sessionId }) as {
    message_count: number
    avg_latency_ms: number | null
    error_count: number
  }

  return {
    messageCount: row.message_count,
    avgLatencyMs: row.avg_latency_ms,
    errorCount: row.error_count
  }
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
      SELECT id, session_id, direction, payload_json, latency_ms, is_error, created_at
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
    createdAt: row.created_at,
    ...(row.latency_ms !== null ? { latencyMs: row.latency_ms } : {}),
    ...(row.is_error === 1 ? { isError: true } : {})
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
        s.server_profile_id,
        sp.name AS server_profile_name,
        s.status,
        s.error_text,
        s.connected_at,
        s.disconnected_at,
        COUNT(m.id) AS message_count,
        AVG(m.latency_ms) AS avg_latency_ms,
        SUM(CASE WHEN m.is_error = 1 THEN 1 ELSE 0 END) AS error_count
      FROM sessions s
      LEFT JOIN messages m ON m.session_id = s.id
      LEFT JOIN server_profiles sp ON sp.id = s.server_profile_id
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
    serverProfileId: row.server_profile_id,
    serverProfileName: row.server_profile_name,
    state: row.status,
    error: row.error_text,
    connectedAt: row.connected_at,
    disconnectedAt: row.disconnected_at,
    messageCount: row.message_count,
    avgLatencyMs: row.avg_latency_ms,
    errorCount: row.error_count
  }))
}
