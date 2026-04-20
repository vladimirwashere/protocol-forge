import { create } from 'zustand'

type ToastKind = 'info' | 'success' | 'error'

export type ToastAction = {
  label: string
  onClick: () => void
}

export type Toast = {
  id: number
  title: string
  message: string
  kind: ToastKind
  createdAt: number
  action?: ToastAction
}

type ShowToastInput = {
  title: string
  message: string
  kind?: ToastKind
  durationMs?: number
  action?: ToastAction
}

type ToastStoreState = {
  toasts: Toast[]
  showToast: (input: ShowToastInput) => number
  dismissToast: (id: number) => void
  clearToasts: () => void
}

let nextToastId = 1

export const useToastStore = create<ToastStoreState>((set) => ({
  toasts: [],

  showToast: ({ title, message, kind = 'info', durationMs = 5000, action }) => {
    const id = nextToastId
    nextToastId += 1

    const toast: Toast = {
      id,
      title,
      message,
      kind,
      createdAt: Date.now(),
      ...(action ? { action } : {})
    }

    set((state) => ({
      toasts: [...state.toasts, toast].slice(-5)
    }))

    if (durationMs > 0) {
      window.setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((item) => item.id !== id)
        }))
      }, durationMs)
    }

    return id
  },

  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id)
    }))
  },

  clearToasts: () => {
    set({ toasts: [] })
  }
}))
