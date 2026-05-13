import { describe, expect, it } from 'vitest'

import { buildStatusFromRuntime } from '../src/main/mcp/session/status'

type FakeClient = { getServerCapabilities: () => unknown }

function buildRuntime(client: FakeClient): Parameters<typeof buildStatusFromRuntime>[0] {
  return {
    id: 'sess-1',
    state: 'ready',
    transport: 'stdio',
    connectedAt: new Date().toISOString(),
    client: client as unknown as Parameters<typeof buildStatusFromRuntime>[0]['client']
  }
}

const baseStats = { messageCount: 0, avgLatencyMs: null, errorCount: 0 }

describe('buildStatusFromRuntime serverCapabilities projection', () => {
  it('omits serverCapabilities when SDK reports undefined', () => {
    const runtime = buildRuntime({ getServerCapabilities: () => undefined })
    const status = buildStatusFromRuntime(runtime, baseStats)
    expect(status.serverCapabilities).toBeUndefined()
  })

  it('projects logging and completions presence as booleans', () => {
    const runtime = buildRuntime({
      getServerCapabilities: () => ({ logging: {}, completions: {} })
    })
    const status = buildStatusFromRuntime(runtime, baseStats)
    expect(status.serverCapabilities).toEqual({
      completions: true,
      resourceSubscribe: false,
      resourceListChanged: false,
      logging: true
    })
  })

  it('projects resource subscribe and listChanged when set', () => {
    const runtime = buildRuntime({
      getServerCapabilities: () => ({
        resources: { subscribe: true, listChanged: true }
      })
    })
    const status = buildStatusFromRuntime(runtime, baseStats)
    expect(status.serverCapabilities).toEqual({
      completions: false,
      resourceSubscribe: true,
      resourceListChanged: true,
      logging: false
    })
  })

  it('treats missing resources sub-fields as false (no truthy coercion)', () => {
    const runtime = buildRuntime({
      getServerCapabilities: () => ({ resources: { subscribe: 'yes' } })
    })
    const status = buildStatusFromRuntime(runtime, baseStats)
    expect(status.serverCapabilities?.resourceSubscribe).toBe(false)
  })

  it('omits serverCapabilities when the SDK throws (handshake not finished)', () => {
    const runtime = buildRuntime({
      getServerCapabilities: () => {
        throw new Error('not connected yet')
      }
    })
    const status = buildStatusFromRuntime(runtime, baseStats)
    expect(status.serverCapabilities).toBeUndefined()
  })
})
