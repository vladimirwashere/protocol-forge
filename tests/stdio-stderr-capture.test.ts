import { describe, expect, it } from 'vitest'
import { getStdioStderrTail } from '../src/main/mcp/transports/stdio-transport'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'

describe('getStdioStderrTail', () => {
  it('returns empty string for transports that were not registered', () => {
    const unknown = {} as unknown as Transport
    expect(getStdioStderrTail(unknown)).toBe('')
  })
})
