import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  DiscoveryCallToolInput,
  DiscoveryGetPromptInput,
  DiscoveryPrompt,
  DiscoveryReadResourceInput,
  DiscoveryResource,
  DiscoveryResourceTemplate,
  DiscoverySessionInput,
  DiscoveryTool,
  SessionStatus
} from '../src/shared/ipc'
import { useDiscoveryStore } from '../src/renderer/src/stores/discovery-store'

type MockApi = {
  listTools: ReturnType<
    typeof vi.fn<(input: DiscoverySessionInput) => Promise<{ tools: DiscoveryTool[] }>>
  >
  listResources: ReturnType<
    typeof vi.fn<(input: DiscoverySessionInput) => Promise<{ resources: DiscoveryResource[] }>>
  >
  listResourceTemplates: ReturnType<
    typeof vi.fn<
      (input: DiscoverySessionInput) => Promise<{ resourceTemplates: DiscoveryResourceTemplate[] }>
    >
  >
  listPrompts: ReturnType<
    typeof vi.fn<(input: DiscoverySessionInput) => Promise<{ prompts: DiscoveryPrompt[] }>>
  >
  callTool: ReturnType<
    typeof vi.fn<(input: DiscoveryCallToolInput) => Promise<{ result: unknown }>>
  >
  readResource: ReturnType<
    typeof vi.fn<(input: DiscoveryReadResourceInput) => Promise<{ result: unknown }>>
  >
  getPrompt: ReturnType<
    typeof vi.fn<(input: DiscoveryGetPromptInput) => Promise<{ result: unknown }>>
  >
}

const readySession: SessionStatus = {
  sessionId: 'session-1',
  state: 'ready',
  transport: 'stdio',
  connectedAt: '2026-03-13T00:00:00.000Z',
  messageCount: 0,
  errorCount: 0
}

const setupWindowApi = (): MockApi => {
  const api: MockApi = {
    listTools: vi.fn(async () => ({ tools: [] })),
    listResources: vi.fn(async () => ({ resources: [] })),
    listResourceTemplates: vi.fn(async () => ({ resourceTemplates: [] })),
    listPrompts: vi.fn(async () => ({ prompts: [] })),
    callTool: vi.fn(async () => ({ result: { ok: true } })),
    readResource: vi.fn(async () => ({ result: { contents: [] } })),
    getPrompt: vi.fn(async () => ({ result: { messages: [] } }))
  }

  ;(globalThis as unknown as { window: { api: MockApi } }).window = { api }

  return api
}

describe('discovery-store', () => {
  beforeEach(() => {
    useDiscoveryStore.setState(useDiscoveryStore.getInitialState(), true)
  })

  it('hydrates discovery data for ready sessions', async () => {
    const api = setupWindowApi()

    api.listTools.mockResolvedValueOnce({
      tools: [{ name: 'echo', inputSchema: { type: 'object' } }]
    })
    api.listResources.mockResolvedValueOnce({
      resources: [{ name: 'Config', uri: 'resource://config' }]
    })
    api.listPrompts.mockResolvedValueOnce({
      prompts: [{ name: 'Summarize' }]
    })

    await useDiscoveryStore.getState().hydrateDiscovery(readySession)

    const state = useDiscoveryStore.getState()
    expect(state.tools).toHaveLength(1)
    expect(state.resources).toHaveLength(1)
    expect(state.prompts).toHaveLength(1)
    expect(state.error).toBeNull()
  })

  it('clears data and avoids API calls for non-ready sessions', async () => {
    const api = setupWindowApi()

    useDiscoveryStore.setState({
      tools: [{ name: 'stale', inputSchema: {} }],
      resources: [{ name: 'stale', uri: 'resource://stale' }],
      prompts: [{ name: 'stale' }],
      error: 'old error'
    })

    await useDiscoveryStore.getState().hydrateDiscovery(null)

    const state = useDiscoveryStore.getState()
    expect(state.tools).toEqual([])
    expect(state.resources).toEqual([])
    expect(state.prompts).toEqual([])
    expect(state.error).toBeNull()
    expect(api.listTools).not.toHaveBeenCalled()
    expect(api.listResources).not.toHaveBeenCalled()
    expect(api.listResourceTemplates).not.toHaveBeenCalled()
    expect(api.listPrompts).not.toHaveBeenCalled()
  })

  it('invokes a tool and stores result metadata', async () => {
    const api = setupWindowApi()
    api.callTool.mockResolvedValueOnce({ result: { data: 42 } })

    await useDiscoveryStore.getState().invokeTool(readySession, 'echo', { value: 'x' })

    const state = useDiscoveryStore.getState()
    expect(api.callTool).toHaveBeenCalledWith({
      sessionId: 'session-1',
      name: 'echo',
      arguments: { value: 'x' }
    })
    expect(state.activeResult).toEqual({ data: 42 })
    expect(state.activeResultTitle).toBe('Tool result: echo')
    expect(state.error).toBeNull()
  })

  it('returns a user-facing error when invoking without a ready session', async () => {
    setupWindowApi()

    await useDiscoveryStore.getState().invokeTool(null, 'echo', {})

    const state = useDiscoveryStore.getState()
    expect(state.error).toBe('Connect a ready session before invoking tools.')
  })
})
