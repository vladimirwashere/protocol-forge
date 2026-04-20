import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { SessionConnectInput } from '../../../shared/ipc'
import { AppError } from '../../../shared/errors'
import { createTracedStdioTransport } from './stdio-transport'
import { createTracedStreamableHttpTransport } from './streamable-http-transport'
import type { MessageTraceHandler } from './tracing-transport'

export function createTracedTransport(
  input: SessionConnectInput,
  onTrace: MessageTraceHandler
): Transport {
  switch (input.transport) {
    case 'stdio':
      return createTracedStdioTransport(input.stdio, onTrace)
    case 'streamable-http':
      return createTracedStreamableHttpTransport(input.streamableHttp, onTrace)
    default:
      throw new AppError('INVALID_INPUT', 'Unsupported transport type')
  }
}
