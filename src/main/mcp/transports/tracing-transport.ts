import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import type { Transport, TransportSendOptions } from '@modelcontextprotocol/sdk/shared/transport.js'

export type TraceDirection = 'outbound' | 'inbound'

export type MessageTraceHandler = (direction: TraceDirection, message: JSONRPCMessage) => void

export class TracingTransport implements Transport {
  private readonly inner: Transport
  private readonly onTrace: MessageTraceHandler

  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: <T extends JSONRPCMessage>(message: T) => void
  sessionId?: string
  setProtocolVersion?: (version: string) => void

  constructor(inner: Transport, onTrace: MessageTraceHandler) {
    this.inner = inner
    this.onTrace = onTrace
  }

  async start(): Promise<void> {
    this.inner.onclose = () => {
      this.onclose?.()
    }

    this.inner.onerror = (error) => {
      this.onerror?.(error)
    }

    this.inner.onmessage = (message) => {
      this.onTrace('inbound', message)
      this.onmessage?.(message)
    }

    this.inner.setProtocolVersion = (version) => {
      this.setProtocolVersion?.(version)
    }

    await this.inner.start()
    if (this.inner.sessionId !== undefined) {
      this.sessionId = this.inner.sessionId
    }
  }

  async send(message: JSONRPCMessage, options?: TransportSendOptions): Promise<void> {
    this.onTrace('outbound', message)
    await this.inner.send(message, options)
  }

  async close(): Promise<void> {
    await this.inner.close()
  }
}
