import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { SessionState, SessionTransport } from '../../../shared/ipc'

export type SessionEvent =
  | 'start-connect'
  | 'connected'
  | 'start-disconnect'
  | 'disconnected'
  | 'fail'

export type RuntimeSession = {
  id: string
  state: SessionState
  transport: SessionTransport
  serverProfileId?: string
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
