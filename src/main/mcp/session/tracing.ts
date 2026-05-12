import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import type { SessionMessage } from '../../../shared/ipc'
import { insertSessionMessage } from '../../persistence/sessionsRepo'

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const asJsonRpcId = (value: unknown): string | number | null => {
  if (typeof value === 'string' || typeof value === 'number') {
    return value
  }

  return null
}

export class MessageRecorder {
  private readonly listeners = new Set<(message: SessionMessage) => void>()
  private readonly outboundRequestTimes = new Map<string, number>()

  onMessage(listener: (message: SessionMessage) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  clearPendingRequestTimes(sessionId: string): void {
    const prefix = `${sessionId}:`
    for (const key of this.outboundRequestTimes.keys()) {
      if (key.startsWith(prefix)) {
        this.outboundRequestTimes.delete(key)
      }
    }
  }

  capture(sessionId: string, direction: 'outbound' | 'inbound', message: JSONRPCMessage): void {
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

    for (const listener of this.listeners) {
      listener(streamedMessage)
    }
  }
}
