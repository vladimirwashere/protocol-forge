import { describe, expect, it } from 'vitest'
import { ClientCapabilitiesSchema } from '@modelcontextprotocol/sdk/types.js'

import { CLIENT_CAPABILITIES } from '../src/main/mcp/client-capabilities'

describe('CLIENT_CAPABILITIES', () => {
  it('parses against the SDK ClientCapabilities schema', () => {
    expect(() => ClientCapabilitiesSchema.parse(CLIENT_CAPABILITIES)).not.toThrow()
  })

  it('advertises sampling, elicitation (form + url), and roots.listChanged', () => {
    expect(CLIENT_CAPABILITIES.sampling).toEqual({})
    expect(CLIENT_CAPABILITIES.elicitation).toEqual({ form: {}, url: {} })
    expect(CLIENT_CAPABILITIES.roots).toEqual({ listChanged: true })
  })

  it('does not advertise deferred capabilities (tasks, sampling.tools, sampling.context)', () => {
    expect(CLIENT_CAPABILITIES).not.toHaveProperty('tasks')
    expect(CLIENT_CAPABILITIES.sampling).not.toHaveProperty('tools')
    expect(CLIENT_CAPABILITIES.sampling).not.toHaveProperty('context')
  })
})
