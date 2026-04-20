import { create } from 'zustand'
import type {
  ServerProfile,
  SessionMessage,
  SessionStatus,
  SessionSummary
} from '../../../shared/ipc'
import { normalizeLegacyArgs } from './server-store-utils'

const ACTIVE_MESSAGE_LIMIT = 100

let unsubscribeMessageStream: (() => void) | null = null

const toSessionSummary = (status: SessionStatus): SessionSummary => {
  const summary: SessionSummary = {
    sessionId: status.sessionId,
    state: status.state,
    transport: status.transport,
    connectedAt: status.connectedAt,
    messageCount: status.messageCount,
    errorCount: status.errorCount
  }

  if (status.serverProfileId !== undefined) {
    summary.serverProfileId = status.serverProfileId
  }

  if (status.serverProfileName !== undefined) {
    summary.serverProfileName = status.serverProfileName
  }

  if (status.disconnectedAt !== undefined) {
    summary.disconnectedAt = status.disconnectedAt
  }

  if (status.error !== undefined) {
    summary.error = status.error
  }

  if (status.avgLatencyMs !== undefined) {
    summary.avgLatencyMs = status.avgLatencyMs
  }

  if (status.durationMs !== undefined) {
    summary.durationMs = status.durationMs
  }

  return summary
}

const ensureMessageStreamSubscription = (
  set: (
    partial:
      | Partial<SessionStoreState>
      | ((state: SessionStoreState) => Partial<SessionStoreState> | SessionStoreState)
  ) => void
): void => {
  if (unsubscribeMessageStream !== null) {
    return
  }

  unsubscribeMessageStream = window.api.subscribeSessionMessages((messages) => {
    if (messages.length === 0) {
      return
    }

    set((state) => {
      if (!state.sessionStatus) {
        return state
      }

      const incomingForActive = messages.filter(
        (message) => message.sessionId === state.sessionStatus?.sessionId
      )

      if (incomingForActive.length === 0) {
        return state
      }

      const knownIds = new Set(state.sessionMessages.map((message) => message.id))
      const dedupedIncoming = incomingForActive.filter((message) => !knownIds.has(message.id))
      if (dedupedIncoming.length === 0) {
        return state
      }

      const mergedMessages = [...state.sessionMessages, ...dedupedIncoming]
      const nextMessages = mergedMessages.slice(-ACTIVE_MESSAGE_LIMIT)
      const nextMessageCount = state.sessionStatus.messageCount + dedupedIncoming.length

      const nextSessionStatus: SessionStatus = {
        ...state.sessionStatus,
        messageCount: nextMessageCount
      }

      const nextSessionHistory = state.sessionHistory.map((session) => {
        if (session.sessionId !== nextSessionStatus.sessionId) {
          return session
        }

        return {
          ...session,
          messageCount: nextMessageCount
        }
      })

      return {
        sessionStatus: nextSessionStatus,
        sessionMessages: nextMessages,
        sessionHistory: nextSessionHistory
      }
    })
  })
}

type SessionStoreState = {
  sessionStatus: SessionStatus | null
  sessionMessages: SessionMessage[]
  sessionHistory: SessionSummary[]
  sessionError: string | null
  setSessionError: (value: string | null) => void
  refreshSessionHistory: () => Promise<void>
  inspectSession: (sessionId: string) => Promise<void>
  connectProfile: (profile: ServerProfile) => Promise<void>
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
    ensureMessageStreamSubscription(set)

    const [status, messages] = await Promise.all([
      window.api.getSessionStatus({ sessionId }),
      window.api.getSessionMessages({ sessionId, limit: ACTIVE_MESSAGE_LIMIT })
    ])

    set({
      sessionStatus: status,
      sessionMessages: messages
    })
  },

  connectProfile: async (profile) => {
    ensureMessageStreamSubscription(set)

    set({ sessionError: null })

    try {
      const connected = await (() => {
        if (profile.transport === 'stdio') {
          const stdioInput: {
            command: string
            args: string[]
            cwd?: string
          } = {
            command: profile.command ?? '',
            args: normalizeLegacyArgs(profile.args ?? [])
          }

          if (profile.cwd !== undefined) {
            stdioInput.cwd = profile.cwd
          }

          return window.api.connectSession({
            transport: 'stdio',
            stdio: stdioInput,
            profileId: profile.id
          })
        }

        const urlInput: {
          url: string
          headers?: Record<string, string>
        } = {
          url: profile.url ?? ''
        }

        if (profile.headers !== undefined) {
          urlInput.headers = profile.headers
        }

        if (profile.transport === 'streamable-http') {
          return window.api.connectSession({
            transport: 'streamable-http',
            streamableHttp: urlInput,
            profileId: profile.id
          })
        }

        return window.api.connectSession({
          transport: 'sse',
          sse: urlInput,
          profileId: profile.id
        })
      })()

      const [status, messages] = await Promise.all([
        window.api.getSessionStatus({ sessionId: connected.sessionId }),
        window.api.getSessionMessages({
          sessionId: connected.sessionId,
          limit: ACTIVE_MESSAGE_LIMIT
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
          limit: ACTIVE_MESSAGE_LIMIT
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
      limit: ACTIVE_MESSAGE_LIMIT
    })

    const updatedHistory = sessionHistory.map((session) => {
      if (session.sessionId !== status.sessionId) {
        return session
      }

      return toSessionSummary(status)
    })

    set({
      sessionStatus: status,
      sessionMessages: messages,
      sessionHistory: updatedHistory
    })
  },

  hydrateSessionList: async () => {
    ensureMessageStreamSubscription(set)

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
