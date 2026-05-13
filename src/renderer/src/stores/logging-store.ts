import { create } from 'zustand'

import { LOG_LEVELS, type LogLevel, type LogNotification } from '../../../shared/ipc'

const MAX_BUFFER = 300

type LogEntry = LogNotification & { id: number }

type LoggingStoreState = {
  sessionId: string | null
  entries: LogEntry[]
  minLevel: LogLevel
  selectedLevel: LogLevel
  setLevelPending: boolean
  setLevelError: string | null
  nextId: number
  ingest: (notification: LogNotification) => void
  setActiveSession: (sessionId: string | null) => void
  setMinLevel: (level: LogLevel) => void
  setSelectedLevel: (level: LogLevel) => void
  applyLevelToServer: (sessionId: string, level: LogLevel) => Promise<void>
  clear: () => void
  subscribe: () => () => void
}

export const LEVEL_RANK: Record<LogLevel, number> = LOG_LEVELS.reduce(
  (acc, level, idx) => {
    acc[level] = idx
    return acc
  },
  {} as Record<LogLevel, number>
)

export function isAtLeast(level: LogLevel, threshold: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[threshold]
}

export const useLoggingStore = create<LoggingStoreState>((set, get) => ({
  sessionId: null,
  entries: [],
  minLevel: 'debug',
  selectedLevel: 'info',
  setLevelPending: false,
  setLevelError: null,
  nextId: 1,

  ingest: (notification) => {
    set((state) => {
      // Only buffer logs for the active session; switching sessions resets the panel.
      if (state.sessionId === null || state.sessionId !== notification.sessionId) return state
      const id = state.nextId
      const entry: LogEntry = { ...notification, id }
      const next = [...state.entries, entry]
      if (next.length > MAX_BUFFER) next.splice(0, next.length - MAX_BUFFER)
      return { entries: next, nextId: id + 1 }
    })
  },

  setActiveSession: (sessionId) => {
    set((state) => {
      if (state.sessionId === sessionId) return state
      return {
        sessionId,
        entries: [],
        minLevel: 'debug',
        setLevelError: null
      }
    })
  },

  setMinLevel: (level) => {
    set({ minLevel: level })
  },

  setSelectedLevel: (level) => {
    set({ selectedLevel: level })
  },

  applyLevelToServer: async (sessionId, level) => {
    set({ setLevelPending: true, setLevelError: null, selectedLevel: level })
    try {
      await window.api.setLoggingLevel({ sessionId, level })
      set({ setLevelPending: false })
    } catch (error) {
      set({
        setLevelPending: false,
        setLevelError: error instanceof Error ? error.message : `Failed to set log level`
      })
    }
  },

  clear: () => {
    set({ entries: [] })
  },

  subscribe: () => {
    return window.api.subscribeLogNotifications((notification) => {
      get().ingest(notification)
    })
  }
}))
