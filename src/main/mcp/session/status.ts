import type {
  SessionServerCapabilities,
  SessionState,
  SessionStatus,
  SessionSummary
} from '../../../shared/ipc'
import type {
  SessionRecord,
  SessionStatsRecord,
  SessionSummaryRecord
} from '../../persistence/sessionsRepo'
import type { RuntimeSession } from './state-machine'

export function getDurationMs(connectedAt: string, disconnectedAt?: string): number {
  const startedAt = Date.parse(connectedAt)
  const endedAt = Date.parse(disconnectedAt ?? new Date().toISOString())

  if (Number.isNaN(startedAt) || Number.isNaN(endedAt)) {
    return 0
  }

  return Math.max(0, endedAt - startedAt)
}

function projectServerCapabilities(runtime: RuntimeSession): SessionServerCapabilities | undefined {
  // Capabilities are only meaningful after the initialize handshake; before then the SDK
  // returns undefined and the renderer should not gate anything on a half-known shape.
  let caps: Record<string, unknown> | undefined
  try {
    caps = runtime.client.getServerCapabilities() as Record<string, unknown> | undefined
  } catch {
    return undefined
  }
  if (!caps) return undefined

  const resources = (caps.resources ?? {}) as Record<string, unknown>

  return {
    completions: caps.completions !== undefined,
    resourceSubscribe: resources.subscribe === true,
    resourceListChanged: resources.listChanged === true,
    logging: caps.logging !== undefined
  }
}

export function buildStatusFromRuntime(
  runtime: RuntimeSession,
  stats: SessionStatsRecord
): SessionStatus {
  const status: SessionStatus = {
    sessionId: runtime.id,
    state: runtime.state,
    transport: runtime.transport,
    ...(runtime.serverProfileId !== undefined ? { serverProfileId: runtime.serverProfileId } : {}),
    connectedAt: runtime.connectedAt,
    messageCount: stats.messageCount,
    errorCount: stats.errorCount,
    ...(stats.avgLatencyMs !== null ? { avgLatencyMs: stats.avgLatencyMs } : {}),
    durationMs: getDurationMs(runtime.connectedAt, runtime.disconnectedAt)
  }

  if (runtime.disconnectedAt !== undefined) status.disconnectedAt = runtime.disconnectedAt
  if (runtime.error !== undefined) status.error = runtime.error

  const serverCapabilities = projectServerCapabilities(runtime)
  if (serverCapabilities) status.serverCapabilities = serverCapabilities

  return status
}

export function buildStatusFromPersisted(
  persisted: SessionRecord,
  stats: SessionStatsRecord
): SessionStatus {
  const status: SessionStatus = {
    sessionId: persisted.id,
    state: persisted.status as SessionState,
    transport: persisted.transportType,
    ...(persisted.serverProfileId !== null ? { serverProfileId: persisted.serverProfileId } : {}),
    connectedAt: persisted.connectedAt,
    messageCount: stats.messageCount,
    errorCount: stats.errorCount,
    ...(stats.avgLatencyMs !== null ? { avgLatencyMs: stats.avgLatencyMs } : {}),
    durationMs: getDurationMs(persisted.connectedAt, persisted.disconnectedAt ?? undefined)
  }

  if (persisted.disconnectedAt !== null) status.disconnectedAt = persisted.disconnectedAt
  if (persisted.errorText !== null) status.error = persisted.errorText

  return status
}

export function mapSessionSummary(session: SessionSummaryRecord): SessionSummary {
  const summary: SessionSummary = {
    sessionId: session.sessionId,
    state: session.state as SessionState,
    transport: session.transport,
    ...(session.serverProfileId !== null ? { serverProfileId: session.serverProfileId } : {}),
    ...(session.serverProfileName !== null ? { serverProfileName: session.serverProfileName } : {}),
    connectedAt: session.connectedAt,
    messageCount: session.messageCount,
    errorCount: session.errorCount,
    ...(session.avgLatencyMs !== null ? { avgLatencyMs: session.avgLatencyMs } : {}),
    durationMs: getDurationMs(session.connectedAt, session.disconnectedAt ?? undefined)
  }

  if (session.disconnectedAt !== null) summary.disconnectedAt = session.disconnectedAt
  if (session.error !== null) summary.error = session.error

  return summary
}
