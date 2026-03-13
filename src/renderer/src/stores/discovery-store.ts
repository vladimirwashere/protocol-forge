import { create } from 'zustand'
import type {
  DiscoveryPrompt,
  DiscoveryResource,
  DiscoveryTool,
  SessionStatus
} from '../../../shared/ipc'

type DiscoveryTab = 'tools' | 'resources' | 'prompts'

type DiscoveryStoreState = {
  activeTab: DiscoveryTab
  tools: DiscoveryTool[]
  resources: DiscoveryResource[]
  prompts: DiscoveryPrompt[]
  activeResult: unknown | null
  activeResultTitle: string | null
  loading: boolean
  error: string | null
  setActiveTab: (tab: DiscoveryTab) => void
  clearResult: () => void
  hydrateDiscovery: (sessionStatus: SessionStatus | null) => Promise<void>
  invokeTool: (
    sessionStatus: SessionStatus | null,
    name: string,
    args: Record<string, unknown>
  ) => Promise<void>
  loadResource: (sessionStatus: SessionStatus | null, uri: string) => Promise<void>
  loadPrompt: (
    sessionStatus: SessionStatus | null,
    name: string,
    args: Record<string, string>
  ) => Promise<void>
}

const clearData = {
  tools: [] as DiscoveryTool[],
  resources: [] as DiscoveryResource[],
  prompts: [] as DiscoveryPrompt[]
}

const isReadySession = (sessionStatus: SessionStatus | null): sessionStatus is SessionStatus => {
  return sessionStatus !== null && sessionStatus.state === 'ready'
}

export const useDiscoveryStore = create<DiscoveryStoreState>((set) => ({
  activeTab: 'tools',
  ...clearData,
  activeResult: null,
  activeResultTitle: null,
  loading: false,
  error: null,

  setActiveTab: (tab) => {
    set({ activeTab: tab })
  },

  clearResult: () => {
    set({ activeResult: null, activeResultTitle: null })
  },

  hydrateDiscovery: async (sessionStatus) => {
    if (!isReadySession(sessionStatus)) {
      set({ ...clearData, loading: false, error: null })
      return
    }

    set({ loading: true, error: null })

    try {
      const [tools, resources, prompts] = await Promise.all([
        window.api.listTools({ sessionId: sessionStatus.sessionId }),
        window.api.listResources({ sessionId: sessionStatus.sessionId }),
        window.api.listPrompts({ sessionId: sessionStatus.sessionId })
      ])

      set({
        tools: tools.tools,
        resources: resources.resources,
        prompts: prompts.prompts,
        loading: false
      })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load discovery data'
      })
    }
  },

  invokeTool: async (sessionStatus, name, args) => {
    if (!isReadySession(sessionStatus)) {
      set({ error: 'Connect a ready session before invoking tools.' })
      return
    }

    set({ loading: true, error: null })

    try {
      const response = await window.api.callTool({
        sessionId: sessionStatus.sessionId,
        name,
        arguments: args
      })

      set({
        loading: false,
        activeResult: response.result,
        activeResultTitle: `Tool result: ${name}`
      })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : `Failed to invoke ${name}`
      })
    }
  },

  loadResource: async (sessionStatus, uri) => {
    if (!isReadySession(sessionStatus)) {
      set({ error: 'Connect a ready session before reading resources.' })
      return
    }

    set({ loading: true, error: null })

    try {
      const response = await window.api.readResource({
        sessionId: sessionStatus.sessionId,
        uri
      })

      set({
        loading: false,
        activeResult: response.result,
        activeResultTitle: `Resource: ${uri}`
      })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : `Failed to read resource ${uri}`
      })
    }
  },

  loadPrompt: async (sessionStatus, name, args) => {
    if (!isReadySession(sessionStatus)) {
      set({ error: 'Connect a ready session before loading prompts.' })
      return
    }

    set({ loading: true, error: null })

    try {
      const response = await window.api.getPrompt({
        sessionId: sessionStatus.sessionId,
        name,
        arguments: args
      })

      set({
        loading: false,
        activeResult: response.result,
        activeResultTitle: `Prompt: ${name}`
      })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : `Failed to load prompt ${name}`
      })
    }
  }
}))
