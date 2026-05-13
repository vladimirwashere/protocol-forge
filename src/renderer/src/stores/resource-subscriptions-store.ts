import { create } from 'zustand'

type SubscriptionState = {
  pending: boolean
  lastUpdateAt: string | null
}

type StoreState = {
  bySession: Record<string, Record<string, SubscriptionState>>
  error: string | null
  isSubscribed: (sessionId: string, uri: string) => boolean
  get: (sessionId: string, uri: string) => SubscriptionState | undefined
  subscribe: (sessionId: string, uri: string) => Promise<void>
  unsubscribe: (sessionId: string, uri: string) => Promise<void>
  markUpdated: (sessionId: string, uri: string, at: string) => void
  clearSession: (sessionId: string) => void
}

function setEntry(
  state: StoreState['bySession'],
  sessionId: string,
  uri: string,
  next: SubscriptionState
): StoreState['bySession'] {
  return {
    ...state,
    [sessionId]: {
      ...(state[sessionId] ?? {}),
      [uri]: next
    }
  }
}

function removeEntry(
  state: StoreState['bySession'],
  sessionId: string,
  uri: string
): StoreState['bySession'] {
  const sessionMap = state[sessionId]
  if (!sessionMap || !(uri in sessionMap)) return state
  const rest = { ...sessionMap }
  delete rest[uri]
  if (Object.keys(rest).length === 0) {
    const without = { ...state }
    delete without[sessionId]
    return without
  }
  return { ...state, [sessionId]: rest }
}

export const useResourceSubscriptionsStore = create<StoreState>((set, get) => ({
  bySession: {},
  error: null,

  isSubscribed: (sessionId, uri) => {
    const session = get().bySession[sessionId]
    return session !== undefined && uri in session
  },

  get: (sessionId, uri) => get().bySession[sessionId]?.[uri],

  subscribe: async (sessionId, uri) => {
    set((state) => ({
      bySession: setEntry(state.bySession, sessionId, uri, {
        pending: true,
        lastUpdateAt: state.bySession[sessionId]?.[uri]?.lastUpdateAt ?? null
      }),
      error: null
    }))
    try {
      await window.api.subscribeResource({ sessionId, uri })
      set((state) => ({
        bySession: setEntry(state.bySession, sessionId, uri, {
          pending: false,
          lastUpdateAt: state.bySession[sessionId]?.[uri]?.lastUpdateAt ?? null
        })
      }))
    } catch (error) {
      set((state) => ({
        bySession: removeEntry(state.bySession, sessionId, uri),
        error: error instanceof Error ? error.message : `Failed to subscribe to ${uri}`
      }))
    }
  },

  unsubscribe: async (sessionId, uri) => {
    set((state) => ({
      bySession: setEntry(state.bySession, sessionId, uri, {
        pending: true,
        lastUpdateAt: state.bySession[sessionId]?.[uri]?.lastUpdateAt ?? null
      }),
      error: null
    }))
    try {
      await window.api.unsubscribeResource({ sessionId, uri })
      set((state) => ({ bySession: removeEntry(state.bySession, sessionId, uri) }))
    } catch (error) {
      // On failure, leave the entry in place so the user can retry, but clear pending.
      set((state) => ({
        bySession: setEntry(state.bySession, sessionId, uri, {
          pending: false,
          lastUpdateAt: state.bySession[sessionId]?.[uri]?.lastUpdateAt ?? null
        }),
        error: error instanceof Error ? error.message : `Failed to unsubscribe from ${uri}`
      }))
    }
  },

  markUpdated: (sessionId, uri, at) => {
    set((state) => {
      // Only track updates for URIs the user is actively subscribed to. The main process
      // already filters but this guards against stale events arriving after unsubscribe.
      if (!state.bySession[sessionId]?.[uri]) return state
      return {
        bySession: setEntry(state.bySession, sessionId, uri, {
          pending: false,
          lastUpdateAt: at
        })
      }
    })
  },

  clearSession: (sessionId) => {
    set((state) => {
      if (!(sessionId in state.bySession)) return state
      const rest = { ...state.bySession }
      delete rest[sessionId]
      return { bySession: rest }
    })
  }
}))
