import { create } from 'zustand'
import type {
  ServerProfile,
  SessionMessage,
  SessionStatus,
  SessionSummary
} from '../../../shared/ipc'

type SessionStoreState = {
  sessionStatus: SessionStatus | null
  sessionMessages: SessionMessage[]
  sessionHistory: SessionSummary[]
  sessionError: string | null
  setSessionError: (value: string | null) => void
  refreshSessionHistory: () => Promise<void>
  inspectSession: (sessionId: string) => Promise<void>
  connectProfile: (profile: ServerProfile) => Promise<void>
  connectSseUrl: (url: string) => Promise<void>
  disconnectActiveSession: () => Promise<void>
  refreshActiveSessionMessages: () => Promise<void>
  hydrateSessionList: () => Promise<void>
}

export const useSessionStore = create<SessionStoreState>((set, get) => ({
  sessionStatus: null,
  sessionMessages: [],
  sessionHistory: [],
  sessionError: null,

  setSessionError: (value) => {
    set({ sessionError: value })
  },

  refreshSessionHistory: async () => {
    const sessions = await window.api.listSessions({ limit: 20 })
    set({ sessionHistory: sessions })
  },

  inspectSession: async (sessionId) => {
    const [status, messages] = await Promise.all([
      window.api.getSessionStatus({ sessionId }),
      window.api.getSessionMessages({ sessionId, limit: 100 })
    ])

    set({
      sessionStatus: status,
      sessionMessages: messages
    })
  },

  connectProfile: async (profile) => {
    set({ sessionError: null })

    try {
      const connected =
        profile.transport === 'stdio'
          ? await (() => {
              const stdioInput: {
                command: string
                args: string[]
                cwd?: string
              } = {
                command: profile.command ?? '',
                args: profile.args ?? []
              }

              if (profile.cwd !== undefined) {
                stdioInput.cwd = profile.cwd
              }

              return window.api.connectSession({
                transport: 'stdio',
                stdio: stdioInput
              })
            })()
          : await (() => {
              const sseInput: {
                url: string
                headers?: Record<string, string>
              } = {
                url: profile.url ?? ''
              }

              if (profile.headers !== undefined) {
                sseInput.headers = profile.headers
              }

              return window.api.connectSession({
                transport: 'sse',
                sse: sseInput
              })
            })()

      const [status, messages] = await Promise.all([
        window.api.getSessionStatus({ sessionId: connected.sessionId }),
        window.api.getSessionMessages({
          sessionId: connected.sessionId,
          limit: 100
        })
      ])

      set({
        sessionStatus: status,
        sessionMessages: messages
      })

      await get().refreshSessionHistory()
    } catch (error) {
      set({
        sessionError: error instanceof Error ? error.message : 'Failed to connect'
      })
    }
  },

  connectSseUrl: async (url) => {
    set({ sessionError: null })

    try {
      const connected = await window.api.connectSession({
        transport: 'sse',
        sse: {
          url
        }
      })

      const [status, messages] = await Promise.all([
        window.api.getSessionStatus({ sessionId: connected.sessionId }),
        window.api.getSessionMessages({
          sessionId: connected.sessionId,
          limit: 100
        })
      ])

      set({
        sessionStatus: status,
        sessionMessages: messages
      })

      await get().refreshSessionHistory()
    } catch (error) {
      set({
        sessionError: error instanceof Error ? error.message : 'Failed to connect via SSE'
      })
    }
  },

  disconnectActiveSession: async () => {
    const { sessionStatus } = get()
    if (!sessionStatus) {
      return
    }

    set({ sessionError: null })

    try {
      await window.api.disconnectSession({ sessionId: sessionStatus.sessionId })
      const [status, messages] = await Promise.all([
        window.api.getSessionStatus({ sessionId: sessionStatus.sessionId }),
        window.api.getSessionMessages({
          sessionId: sessionStatus.sessionId,
          limit: 100
        })
      ])

      set({
        sessionStatus: status,
        sessionMessages: messages
      })

      await get().refreshSessionHistory()
    } catch (error) {
      set({
        sessionError: error instanceof Error ? error.message : 'Failed to disconnect'
      })
    }
  },

  refreshActiveSessionMessages: async () => {
    const { sessionStatus, sessionHistory } = get()
    if (!sessionStatus) {
      set({ sessionMessages: [] })
      return
    }

    const status = await window.api.getSessionStatus({ sessionId: sessionStatus.sessionId })
    const messages = await window.api.getSessionMessages({
      sessionId: sessionStatus.sessionId,
      limit: 100
    })

    const updatedHistory = sessionHistory.map((session) => {
      if (session.sessionId !== status.sessionId) {
        return session
      }

      const updated: SessionSummary = {
        sessionId: status.sessionId,
        state: status.state,
        transport: status.transport,
        connectedAt: status.connectedAt,
        messageCount: status.messageCount
      }

      if (status.disconnectedAt !== undefined) {
        updated.disconnectedAt = status.disconnectedAt
      }

      if (status.error !== undefined) {
        updated.error = status.error
      }

      return updated
    })

    set({
      sessionStatus: status,
      sessionMessages: messages,
      sessionHistory: updatedHistory
    })
  },

  hydrateSessionList: async () => {
    const sessions = await window.api.listSessions({ limit: 20 })

    set({
      sessionHistory: sessions
    })

    const latestSession = sessions.at(0)
    if (!latestSession) {
      return
    }

    await get().inspectSession(latestSession.sessionId)
  }
}))
