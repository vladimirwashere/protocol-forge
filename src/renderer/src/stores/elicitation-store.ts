import { create } from 'zustand'

import type { ElicitationPendingRequest, ElicitationRespondInput } from '../../../shared/ipc'

type ElicitationStoreState = {
  pending: ElicitationPendingRequest[]
  error: string | null
  subscribed: boolean
  subscribe: () => void
  setPending: (pending: ElicitationPendingRequest[]) => void
  refreshPending: () => Promise<void>
  respond: (input: ElicitationRespondInput) => Promise<void>
  clearError: () => void
}

let unsubscribe: (() => void) | null = null

export const useElicitationStore = create<ElicitationStoreState>((set) => ({
  pending: [],
  error: null,
  subscribed: false,

  subscribe: () => {
    if (unsubscribe) return
    set({ subscribed: true })
    unsubscribe = window.api.subscribeElicitations((pending) => {
      set({ pending })
    })

    void window.api
      .listPendingElicitations()
      .then((pending) => {
        set({ pending })
      })
      .catch((error: unknown) => {
        set({
          error: error instanceof Error ? error.message : 'Failed to list elicitation requests'
        })
      })
  },

  setPending: (pending) => {
    set({ pending })
  },

  refreshPending: async () => {
    try {
      const pending = await window.api.listPendingElicitations()
      set({ pending, error: null })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to refresh elicitation requests'
      })
    }
  },

  respond: async (input) => {
    try {
      await window.api.respondElicitation(input)
      set({ error: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to respond to elicitation'
      set({ error: message })
      throw error
    }
  },

  clearError: () => {
    set({ error: null })
  }
}))
