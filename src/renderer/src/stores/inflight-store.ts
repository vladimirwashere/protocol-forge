import { create } from 'zustand'

import type { InflightCancelInput, InflightOperationSummary } from '../../../shared/ipc'

type InflightStoreState = {
  operations: InflightOperationSummary[]
  error: string | null
  subscribed: boolean
  subscribe: () => void
  setOperations: (operations: InflightOperationSummary[]) => void
  refresh: () => Promise<void>
  cancel: (input: InflightCancelInput) => Promise<void>
  clearError: () => void
}

let unsubscribe: (() => void) | null = null

export const useInflightStore = create<InflightStoreState>((set) => ({
  operations: [],
  error: null,
  subscribed: false,

  subscribe: () => {
    if (unsubscribe) return
    set({ subscribed: true })
    unsubscribe = window.api.subscribeInflightOperations((operations) => {
      set({ operations })
    })

    void window.api
      .listInflightOperations()
      .then((operations) => {
        set({ operations })
      })
      .catch((error: unknown) => {
        set({
          error: error instanceof Error ? error.message : 'Failed to list in-flight operations'
        })
      })
  },

  setOperations: (operations) => {
    set({ operations })
  },

  refresh: async () => {
    try {
      const operations = await window.api.listInflightOperations()
      set({ operations, error: null })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to refresh in-flight operations'
      })
    }
  },

  cancel: async (input) => {
    try {
      await window.api.cancelInflightOperation(input)
      set({ error: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cancel operation'
      set({ error: message })
      throw error
    }
  },

  clearError: () => {
    set({ error: null })
  }
}))
