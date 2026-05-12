import { randomUUID } from 'node:crypto'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
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
  SessionMessage,
  SessionState,
  SessionStatus,
  SessionSummary
} from '../../shared/ipc'
import {
  getSessionRecord,
  getSessionStats,
  insertSessionRecord,
  listSessionMessages,
  listSessionSummaries,
  updateSessionRecord
} from '../persistence/sessionsRepo'
import { getServerProfile } from '../persistence/serverProfilesRepo'
import { CLIENT_CAPABILITIES } from './client-capabilities'
import { createTracedTransport } from './transports/transport-factory'
import { getStdioStderrTail } from './transports/stdio-transport'
import type { RuntimeSession } from './session/state-machine'
import { transitionSessionState } from './session/state-machine'
import { MessageRecorder } from './session/tracing'
import * as discovery from './session/discovery'
import { notifyRootsChanged, registerRootsHandler } from './session/roots'
import {
  buildStatusFromPersisted,
  buildStatusFromRuntime,
  mapSessionSummary
} from './session/status'

export { transitionSessionState } from './session/state-machine'
export type { SessionEvent, RuntimeSession } from './session/state-machine'

export class SessionManager {
  private readonly sessions = new Map<string, RuntimeSession>()
  private readonly recorder = new MessageRecorder()

  onMessage(listener: (message: SessionMessage) => void): () => void {
    return this.recorder.onMessage(listener)
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

    let transport: Transport | undefined

    try {
      transport = createTracedTransport(input, (direction, message) => {
        this.recorder.capture(sessionId, direction, message)
      })

      const client = new Client(
        { name: APP_NAME, version: APP_VERSION },
        { enforceStrictCapabilities: true, capabilities: CLIENT_CAPABILITIES }
      )

      registerRootsHandler(client, () => {
        if (input.profileId === undefined) return []
        return getServerProfile(input.profileId)?.roots ?? []
      })

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

      return { sessionId, state: 'ready' }
    } catch (error) {
      const base = getErrorMessage(error)
      const stderrTail = transport ? getStdioStderrTail(transport) : ''
      const message = stderrTail ? `${base}\n\nServer stderr:\n${stderrTail}` : base

      this.setSessionError(sessionId, message)

      throw new AppError('SESSION_CONNECT_FAILED', message, { sessionId })
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
      this.recorder.clearPendingRequestTimes(runtime.id)

      return { ok: true }
    } catch (error) {
      this.setSessionError(runtime.id, getErrorMessage(error))

      throw new AppError('SESSION_DISCONNECT_FAILED', getErrorMessage(error), {
        sessionId: runtime.id
      })
    }
  }

  async shutdown(): Promise<void> {
    const activeSessions = [...this.sessions.values()]

    await Promise.all(
      activeSessions.map(async (session) => {
        try {
          await session.client.close()
          this.setSessionState(session.id, 'disconnected')
          this.recorder.clearPendingRequestTimes(session.id)
        } catch (error) {
          this.setSessionError(session.id, getErrorMessage(error))
        }
      })
    )
  }

  getStatus(sessionId: string): SessionStatus {
    const runtime = this.sessions.get(sessionId)
    const stats = getSessionStats(sessionId)

    if (runtime) {
      return buildStatusFromRuntime(runtime, stats)
    }

    const persisted = getSessionRecord(sessionId)
    if (!persisted) {
      throw new AppError('SESSION_NOT_FOUND', `Session ${sessionId} was not found`)
    }

    return buildStatusFromPersisted(persisted, stats)
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
    return listSessionSummaries(limit).map(mapSessionSummary)
  }

  async listTools(sessionId: string): Promise<DiscoveryListToolsResponse> {
    return discovery.listTools(this.getReadyRuntimeSession(sessionId).client)
  }

  async listResources(sessionId: string): Promise<DiscoveryListResourcesResponse> {
    return discovery.listResources(this.getReadyRuntimeSession(sessionId).client)
  }

  async listPrompts(sessionId: string): Promise<DiscoveryListPromptsResponse> {
    return discovery.listPrompts(this.getReadyRuntimeSession(sessionId).client)
  }

  async callTool(input: DiscoveryCallToolInput): Promise<DiscoveryOperationResult> {
    return discovery.callTool(this.getReadyRuntimeSession(input.sessionId).client, input)
  }

  async readResource(input: DiscoveryReadResourceInput): Promise<DiscoveryOperationResult> {
    return discovery.readResource(this.getReadyRuntimeSession(input.sessionId).client, input)
  }

  async getPrompt(input: DiscoveryGetPromptInput): Promise<DiscoveryOperationResult> {
    return discovery.getPrompt(this.getReadyRuntimeSession(input.sessionId).client, input)
  }

  async notifyRootsChanged(profileId: string): Promise<void> {
    const targets = [...this.sessions.values()].filter(
      (runtime) => runtime.serverProfileId === profileId && runtime.state === 'ready'
    )

    await Promise.all(
      targets.map(async (runtime) => {
        try {
          await notifyRootsChanged(runtime.client)
        } catch (error) {
          this.setSessionError(runtime.id, getErrorMessage(error))
        }
      })
    )
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
    this.recorder.clearPendingRequestTimes(sessionId)
  }
}

export const sessionManager = new SessionManager()
