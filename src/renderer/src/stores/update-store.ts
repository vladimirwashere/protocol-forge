import { create } from 'zustand'
import type { UpdateStatus } from '../../../shared/ipc'

let unsubscribe: (() => void) | null = null

type UpdateStoreState = {
  status: UpdateStatus
  subscribe: () => void
  checkForUpdates: () => Promise<void>
  installUpdate: () => Promise<void>
}

export const useUpdateStore = create<UpdateStoreState>((set) => ({
  status: { state: 'idle' },

  subscribe: () => {
    if (unsubscribe !== null) {
      return
    }

    unsubscribe = window.api.subscribeUpdateStatus((status) => {
      set({ status })
    })
  },

  checkForUpdates: async () => {
    await window.api.checkForUpdates()
  },

  installUpdate: async () => {
    await window.api.installUpdate()
  }
}))

export function applyStatusTransition(
  previous: UpdateStatus,
  next: UpdateStatus
): { toast?: { kind: 'available' | 'downloaded' | 'error'; status: UpdateStatus } } {
  if (previous.state === next.state) {
    if (next.state === 'available' || next.state === 'downloaded') {
      return {}
    }
  }

  if (next.state === 'available') {
    return { toast: { kind: 'available', status: next } }
  }
  if (next.state === 'downloaded') {
    return { toast: { kind: 'downloaded', status: next } }
  }
  if (next.state === 'error' && previous.state !== 'error') {
    return { toast: { kind: 'error', status: next } }
  }

  return {}
}
