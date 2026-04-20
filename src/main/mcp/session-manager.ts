import { randomUUID } from 'node:crypto'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import { APP_NAME, APP_VERSION } from '../../shared/constants'
import { AppError, getErrorMessage } from '../../shared/errors'
import type {
  DiscoveryCallToolInput,
  DiscoveryGetPromptInput,
  DiscoveryListPromptsResponse,
  DiscoveryListResourcesResponse,
  DiscoveryListToolsResponse,
  DiscoveryOperationResult,
  DiscoveryReadResourceInput,
  SessionConnectInput,
  SessionConnectResponse,
  SessionDisconnectInput,
  SessionState,
  SessionMessage,
  SessionSummary,
  SessionTransport,
  SessionStatus
} from '../../shared/ipc'
import {
  listSessionSummaries,
  listSessionMessages,
  getSessionRecord,
  getSessionStats,
  insertSessionMessage,
  insertSessionRecord,
  updateSessionRecord
} from '../persistence/sessionsRepo'
import { createTracedTransport } from './transports/transport-factory'

type SessionEvent = 'start-connect' | 'connected' | 'start-disconnect' | 'disconnected' | 'fail'

type RuntimeSession = {
  id: string
  state: SessionState
  transport: SessionTransport
  serverProfileId?: string
  connectedAt: string
  disconnectedAt?: string
  error?: string
  client: Client
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const asJsonRpcId = (value: unknown): string | number | null => {
  if (typeof value === 'string' || typeof value === 'number') {
    return value
  }

  return null
}

const getDurationMs = (connectedAt: string, disconnectedAt?: string): number => {
  const startedAt = Date.parse(connectedAt)
  const endedAt = Date.parse(disconnectedAt ?? new Date().toISOString())

  if (Number.isNaN(startedAt) || Number.isNaN(endedAt)) {
    return 0
  }

  return Math.max(0, endedAt - startedAt)
}

export function transitionSessionState(current: SessionState, event: SessionEvent): SessionState {
  switch (event) {
    case 'start-connect':
      return 'connecting'
    case 'connected':
      return 'ready'
    case 'start-disconnect':
      return current === 'disconnected' ? 'disconnected' : 'disconnecting'
    case 'disconnected':
      return 'disconnected'
    case 'fail':
      return 'error'
    default:
      return current
  }
}

export class SessionManager {
  private readonly sessions = new Map<string, RuntimeSession>()
  private readonly messageListeners = new Set<(message: SessionMessage) => void>()
  private readonly outboundRequestTimes = new Map<string, number>()

  private async runTimedOperation<T>(
    operation: () => Promise<T>
  ): Promise<{ value: T; ms: number }> {
    const startedAt = Date.now()
    const value = await operation()
    return {
      value,
      ms: Math.max(0, Date.now() - startedAt)
    }
  }

  private clearPendingRequestTimes(sessionId: string): void {
    const prefix = `${sessionId}:`
    for (const key of this.outboundRequestTimes.keys()) {
      if (key.startsWith(prefix)) {
        this.outboundRequestTimes.delete(key)
      }
    }
  }

  onMessage(listener: (message: SessionMessage) => void): () => void {
    this.messageListeners.add(listener)

    return () => {
      this.messageListeners.delete(listener)
    }
  }

  async connect(input: SessionConnectInput): Promise<SessionConnectResponse> {
    const sessionId = randomUUID()
    const connectedAt = new Date().toISOString()

    const persistenceSeed = ((): {
      command: string
      args: string[]
      cwd: string
      env: Record<string, string>
    } => {
      if (input.transport === 'stdio') {
        return {
          command: input.stdio.command,
          args: input.stdio.args,
          cwd: input.stdio.cwd ?? process.cwd(),
          env: input.stdio.env ?? {}
        }
      }

      if (input.transport === 'sse') {
        return {
          command: 'sse',
          args: [input.sse.url],
          cwd: '',
          env: input.sse.headers ?? {}
        }
      }

      return {
        command: 'streamable-http',
        args: [input.streamableHttp.url],
        cwd: '',
        env: input.streamableHttp.headers ?? {}
      }
    })()

    insertSessionRecord({
      id: sessionId,
      transportType: input.transport,
      ...(input.profileId !== undefined ? { serverProfileId: input.profileId } : {}),
      command: persistenceSeed.command,
      args: persistenceSeed.args,
      cwd: persistenceSeed.cwd,
      env: persistenceSeed.env,
      status: transitionSessionState('disconnected', 'start-connect'),
      connectedAt
    })

    try {
      const transport = createTracedTransport(input, (direction, message) => {
        this.captureMessage(sessionId, direction, message)
      })

      const client = new Client(
        { name: APP_NAME, version: APP_VERSION },
        { enforceStrictCapabilities: true }
      )

      const runtime: RuntimeSession = {
        id: sessionId,
        state: transitionSessionState('disconnected', 'start-connect'),
        transport: input.transport,
        ...(input.profileId !== undefined ? { serverProfileId: input.profileId } : {}),
        connectedAt,
        client
      }

      this.sessions.set(sessionId, runtime)

      transport.onclose = () => {
        this.setSessionState(sessionId, transitionSessionState(runtime.state, 'disconnected'))
      }

      transport.onerror = (error) => {
        this.setSessionError(sessionId, getErrorMessage(error))
      }

      this.setSessionState(sessionId, 'initializing')
      await client.connect(transport)
      this.setSessionState(sessionId, transitionSessionState('initializing', 'connected'))

      return {
        sessionId,
        state: 'ready'
      }
    } catch (error) {
      this.setSessionError(sessionId, getErrorMessage(error))

      throw new AppError('SESSION_CONNECT_FAILED', getErrorMessage(error), {
        sessionId
      })
    }
  }

  async disconnect(input: SessionDisconnectInput): Promise<{ ok: true }> {
    const runtime = this.sessions.get(input.sessionId)

    if (!runtime) {
      throw new AppError('SESSION_NOT_FOUND', `Session ${input.sessionId} was not found`)
    }

    if (runtime.state === 'disconnecting' || runtime.state === 'disconnected') {
      return { ok: true }
    }

    this.setSessionState(runtime.id, transitionSessionState(runtime.state, 'start-disconnect'))

    try {
      await runtime.client.close()
      this.setSessionState(runtime.id, transitionSessionState(runtime.state, 'disconnected'))
      this.clearPendingRequestTimes(runtime.id)

      return { ok: true }
    } catch (error) {
      this.setSessionError(runtime.id, getErrorMessage(error))

      throw new AppError('SESSION_DISCONNECT_FAILED', getErrorMessage(error), {
        sessionId: runtime.id
      })
    }
  }

  getStatus(sessionId: string): SessionStatus {
    const runtime = this.sessions.get(sessionId)
    const stats = getSessionStats(sessionId)

    if (runtime) {
      const status: SessionStatus = {
        sessionId: runtime.id,
        state: runtime.state,
        transport: runtime.transport,
        ...(runtime.serverProfileId !== undefined
          ? { serverProfileId: runtime.serverProfileId }
          : {}),
        connectedAt: runtime.connectedAt,
        messageCount: stats.messageCount,
        errorCount: stats.errorCount,
        ...(stats.avgLatencyMs !== null ? { avgLatencyMs: stats.avgLatencyMs } : {}),
        durationMs: getDurationMs(runtime.connectedAt, runtime.disconnectedAt)
      }

      if (runtime.disconnectedAt !== undefined) {
        status.disconnectedAt = runtime.disconnectedAt
      }

      if (runtime.error !== undefined) {
        status.error = runtime.error
      }

      return status
    }

    const persisted = getSessionRecord(sessionId)
    if (!persisted) {
      throw new AppError('SESSION_NOT_FOUND', `Session ${sessionId} was not found`)
    }

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

    if (persisted.disconnectedAt !== null) {
      status.disconnectedAt = persisted.disconnectedAt
    }

    if (persisted.errorText !== null) {
      status.error = persisted.errorText
    }

    return status
  }

  async shutdown(): Promise<void> {
    const activeSessions = [...this.sessions.values()]

    await Promise.all(
      activeSessions.map(async (session) => {
        try {
          await session.client.close()
          this.setSessionState(session.id, 'disconnected')
          this.clearPendingRequestTimes(session.id)
        } catch (error) {
          this.setSessionError(session.id, getErrorMessage(error))
        }
      })
    )
  }

  getMessages(sessionId: string, limit = 100): ReturnType<typeof listSessionMessages> {
    const runtime = this.sessions.get(sessionId)
    if (!runtime) {
      const persisted = getSessionRecord(sessionId)
      if (!persisted) {
        throw new AppError('SESSION_NOT_FOUND', `Session ${sessionId} was not found`)
      }
    }

    return listSessionMessages(sessionId, limit)
  }

  listSessions(limit = 25): SessionSummary[] {
    return listSessionSummaries(limit).map((session) => {
      const summary: SessionSummary = {
        sessionId: session.sessionId,
        state: session.state as SessionState,
        transport: session.transport,
        ...(session.serverProfileId !== null ? { serverProfileId: session.serverProfileId } : {}),
        ...(session.serverProfileName !== null
          ? { serverProfileName: session.serverProfileName }
          : {}),
        connectedAt: session.connectedAt,
        messageCount: session.messageCount,
        errorCount: session.errorCount,
        ...(session.avgLatencyMs !== null ? { avgLatencyMs: session.avgLatencyMs } : {}),
        durationMs: getDurationMs(session.connectedAt, session.disconnectedAt ?? undefined)
      }

      if (session.disconnectedAt !== null) {
        summary.disconnectedAt = session.disconnectedAt
      }

      if (session.error !== null) {
        summary.error = session.error
      }

      return summary
    })
  }

  async listTools(sessionId: string): Promise<DiscoveryListToolsResponse> {
    const runtime = this.getReadyRuntimeSession(sessionId)
    const listed = await runtime.client.listTools()

    return {
      tools: listed.tools.map((tool) => {
        const mapped: DiscoveryListToolsResponse['tools'][number] = {
          name: tool.name,
          inputSchema: tool.inputSchema
        }

        if (tool.description !== undefined) {
          mapped.description = tool.description
        }

        if (tool.outputSchema !== undefined) {
          mapped.outputSchema = tool.outputSchema
        }

        if (tool.annotations !== undefined) {
          mapped.annotations = tool.annotations as Record<string, unknown>
        }

        return mapped
      })
    }
  }

  async listResources(sessionId: string): Promise<DiscoveryListResourcesResponse> {
    const runtime = this.getReadyRuntimeSession(sessionId)
    const listed = await runtime.client.listResources()

    return {
      resources: listed.resources.map((resource) => {
        const mapped: DiscoveryListResourcesResponse['resources'][number] = {
          uri: resource.uri,
          name: resource.name
        }

        if (resource.description !== undefined) {
          mapped.description = resource.description
        }

        if (resource.mimeType !== undefined) {
          mapped.mimeType = resource.mimeType
        }

        return mapped
      })
    }
  }

  async listPrompts(sessionId: string): Promise<DiscoveryListPromptsResponse> {
    const runtime = this.getReadyRuntimeSession(sessionId)
    const listed = await runtime.client.listPrompts()

    return {
      prompts: listed.prompts.map((prompt) => {
        const mapped: DiscoveryListPromptsResponse['prompts'][number] = {
          name: prompt.name
        }

        if (prompt.description !== undefined) {
          mapped.description = prompt.description
        }

        if (prompt.arguments !== undefined) {
          mapped.arguments = prompt.arguments.map((argument) => {
            const mappedArgument: NonNullable<
              DiscoveryListPromptsResponse['prompts'][number]['arguments']
            >[number] = {
              name: argument.name
            }

            if (argument.description !== undefined) {
              mappedArgument.description = argument.description
            }

            if (argument.required !== undefined) {
              mappedArgument.required = argument.required
            }

            return mappedArgument
          })
        }

        return mapped
      })
    }
  }

  async callTool(input: DiscoveryCallToolInput): Promise<DiscoveryOperationResult> {
    const runtime = this.getReadyRuntimeSession(input.sessionId)

    const { value, ms } = await this.runTimedOperation(() =>
      runtime.client.callTool({
        name: input.name,
        arguments: input.arguments
      })
    )

    return {
      result: value,
      latencyMs: ms
    }
  }

  async readResource(input: DiscoveryReadResourceInput): Promise<DiscoveryOperationResult> {
    const runtime = this.getReadyRuntimeSession(input.sessionId)

    const { value, ms } = await this.runTimedOperation(() =>
      runtime.client.readResource({
        uri: input.uri
      })
    )

    return {
      result: value,
      latencyMs: ms
    }
  }

  async getPrompt(input: DiscoveryGetPromptInput): Promise<DiscoveryOperationResult> {
    const runtime = this.getReadyRuntimeSession(input.sessionId)

    const { value, ms } = await this.runTimedOperation(() =>
      runtime.client.getPrompt({
        name: input.name,
        arguments: input.arguments
      })
    )

    return {
      result: value,
      latencyMs: ms
    }
  }

  private captureMessage(
    sessionId: string,
    direction: 'outbound' | 'inbound',
    message: JSONRPCMessage
  ): void {
    const createdAt = new Date().toISOString()
    const payloadJson = JSON.stringify(message)
    let latencyMs: number | undefined
    let isError: boolean | undefined

    if (isRecord(message)) {
      const id = asJsonRpcId(message['id'])
      if (id !== null && direction === 'outbound' && typeof message['method'] === 'string') {
        this.outboundRequestTimes.set(`${sessionId}:${String(id)}`, Date.now())
      }

      if (
        id !== null &&
        direction === 'inbound' &&
        (Object.hasOwn(message, 'result') || Object.hasOwn(message, 'error'))
      ) {
        const key = `${sessionId}:${String(id)}`
        const startedAt = this.outboundRequestTimes.get(key)

        if (startedAt !== undefined) {
          latencyMs = Math.max(0, Date.now() - startedAt)
          this.outboundRequestTimes.delete(key)
        }

        if (message['error'] !== undefined) {
          isError = true
        }
      }
    }

    const id = insertSessionMessage({
      sessionId,
      direction,
      payloadJson,
      ...(latencyMs !== undefined ? { latencyMs } : {}),
      ...(isError === true ? { isError: true } : {}),
      createdAt
    })

    const streamedMessage: SessionMessage = {
      id,
      sessionId,
      direction,
      payload: message,
      createdAt,
      ...(latencyMs !== undefined ? { latencyMs } : {}),
      ...(isError === true ? { isError: true } : {})
    }

    for (const listener of this.messageListeners) {
      listener(streamedMessage)
    }
  }

  private getReadyRuntimeSession(sessionId: string): RuntimeSession {
    const runtime = this.sessions.get(sessionId)
    if (!runtime) {
      throw new AppError('SESSION_NOT_FOUND', `Session ${sessionId} was not found`)
    }

    if (runtime.state !== 'ready') {
      throw new AppError('SESSION_NOT_READY', `Session ${sessionId} is not ready`, {
        state: runtime.state
      })
    }

    return runtime
  }

  private setSessionState(sessionId: string, state: SessionState): void {
    const runtime = this.sessions.get(sessionId)
    if (!runtime) {
      return
    }

    runtime.state = state

    if (state === 'disconnected') {
      runtime.disconnectedAt = new Date().toISOString()
      updateSessionRecord(sessionId, state, { disconnectedAt: runtime.disconnectedAt })
      return
    }

    updateSessionRecord(sessionId, state)
  }

  private setSessionError(sessionId: string, errorMessage: string): void {
    const runtime = this.sessions.get(sessionId)
    if (runtime) {
      runtime.state = transitionSessionState(runtime.state, 'fail')
      runtime.error = errorMessage
      runtime.disconnectedAt = new Date().toISOString()
    }

    updateSessionRecord(sessionId, 'error', {
      disconnectedAt: new Date().toISOString(),
      errorText: errorMessage
    })
    this.clearPendingRequestTimes(sessionId)
  }
}

export const sessionManager = new SessionManager()
