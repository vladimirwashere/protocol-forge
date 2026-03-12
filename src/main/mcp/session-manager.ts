import { randomUUID } from 'node:crypto'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import { APP_NAME, APP_VERSION } from '../../shared/constants'
import { AppError, getErrorMessage } from '../../shared/errors'
import type {
  SessionConnectInput,
  SessionConnectResponse,
  SessionDisconnectInput,
  SessionState,
  SessionSummary,
  SessionStatus
} from '../../shared/ipc'
import {
  countSessionMessages,
  listSessionSummaries,
  listSessionMessages,
  getSessionRecord,
  insertSessionMessage,
  insertSessionRecord,
  updateSessionRecord
} from '../persistence/sessionsRepo'
import { createTracedStdioTransport } from './transports/stdio-transport'

type SessionEvent = 'start-connect' | 'connected' | 'start-disconnect' | 'disconnected' | 'fail'

type RuntimeSession = {
  id: string
  state: SessionState
  transport: 'stdio'
  connectedAt: string
  disconnectedAt?: string
  error?: string
  client: Client
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

  async connect(input: SessionConnectInput): Promise<SessionConnectResponse> {
    if (input.transport !== 'stdio') {
      throw new AppError('INVALID_INPUT', 'Unsupported transport type')
    }

    const sessionId = randomUUID()
    const connectedAt = new Date().toISOString()

    insertSessionRecord({
      id: sessionId,
      command: input.stdio.command,
      args: input.stdio.args,
      cwd: input.stdio.cwd ?? process.cwd(),
      env: input.stdio.env ?? {},
      status: transitionSessionState('disconnected', 'start-connect'),
      connectedAt
    })

    try {
      const transport = createTracedStdioTransport(input.stdio, (direction, message) => {
        this.captureMessage(sessionId, direction, message)
      })

      const client = new Client(
        { name: APP_NAME, version: APP_VERSION },
        { enforceStrictCapabilities: true }
      )

      const runtime: RuntimeSession = {
        id: sessionId,
        state: transitionSessionState('disconnected', 'start-connect'),
        transport: 'stdio',
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

    if (runtime) {
      const status: SessionStatus = {
        sessionId: runtime.id,
        state: runtime.state,
        transport: runtime.transport,
        connectedAt: runtime.connectedAt,
        messageCount: countSessionMessages(runtime.id)
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
      connectedAt: persisted.connectedAt,
      messageCount: countSessionMessages(persisted.id)
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
        connectedAt: session.connectedAt,
        messageCount: session.messageCount
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

  private captureMessage(
    sessionId: string,
    direction: 'outbound' | 'inbound',
    message: JSONRPCMessage
  ): void {
    insertSessionMessage({
      sessionId,
      direction,
      payloadJson: JSON.stringify(message),
      createdAt: new Date().toISOString()
    })
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
  }
}

export const sessionManager = new SessionManager()
