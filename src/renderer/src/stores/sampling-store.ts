import { create } from 'zustand'

import type {
  SamplingPendingRequest,
  SamplingRejectInput,
  SamplingRespondInput
} from '../../../shared/ipc'

type SamplingStoreState = {
  pending: SamplingPendingRequest[]
  error: string | null
  subscribed: boolean
  subscribe: () => void
  setPending: (pending: SamplingPendingRequest[]) => void
  refreshPending: () => Promise<void>
  respond: (input: SamplingRespondInput) => Promise<void>
  reject: (input: SamplingRejectInput) => Promise<void>
  clearError: () => void
}

let unsubscribe: (() => void) | null = null

export const useSamplingStore = create<SamplingStoreState>((set) => ({
  pending: [],
  error: null,
  subscribed: false,

  subscribe: () => {
    if (unsubscribe) return
    set({ subscribed: true })
    unsubscribe = window.api.subscribeSampling((pending) => {
      set({ pending })
    })

    void window.api
      .listPendingSampling()
      .then((pending) => {
        set({ pending })
      })
      .catch((error: unknown) => {
        set({ error: error instanceof Error ? error.message : 'Failed to list sampling requests' })
      })
  },

  setPending: (pending) => {
    set({ pending })
  },

  refreshPending: async () => {
    try {
      const pending = await window.api.listPendingSampling()
      set({ pending, error: null })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to refresh sampling requests' })
    }
  },

  respond: async (input) => {
    try {
      await window.api.respondSampling(input)
      set({ error: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to respond to sampling'
      set({ error: message })
      throw error
    }
  },

  reject: async (input) => {
    try {
      await window.api.rejectSampling(input)
      set({ error: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reject sampling'
      set({ error: message })
      throw error
    }
  },

  clearError: () => {
    set({ error: null })
  }
}))
