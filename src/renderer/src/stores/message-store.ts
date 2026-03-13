import { create } from 'zustand'

import type { SessionMessage, SessionMessageDirection } from '../../../shared/ipc'

const MAX_IN_MEMORY_MESSAGES = 300

type MessageFilters = {
  direction: SessionMessageDirection | 'all'
  method: string
  search: string
}

type MessageStoreState = {
  sessionId: string | null
  messages: SessionMessage[]
  paused: boolean
  filters: MessageFilters
  ingestMessages: (sessionId: string | null, messages: SessionMessage[]) => void
  togglePaused: () => void
  clearMessages: () => void
  setDirectionFilter: (direction: MessageFilters['direction']) => void
  setMethodFilter: (method: string) => void
  setSearchFilter: (search: string) => void
}

const trimMessages = (messages: SessionMessage[]): SessionMessage[] => {
  if (messages.length <= MAX_IN_MEMORY_MESSAGES) {
    return messages
  }

  return messages.slice(messages.length - MAX_IN_MEMORY_MESSAGES)
}

const appendNewMessages = (
  current: SessionMessage[],
  incoming: SessionMessage[]
): SessionMessage[] => {
  if (incoming.length === 0) {
    return current
  }

  const knownIds = new Set(current.map((message) => message.id))
  const toAppend = incoming.filter((message) => !knownIds.has(message.id))
  return trimMessages([...current, ...toAppend])
}

export const useMessageStore = create<MessageStoreState>((set) => ({
  sessionId: null,
  messages: [],
  paused: false,
  filters: {
    direction: 'all',
    method: '',
    search: ''
  },

  ingestMessages: (sessionId, messages) => {
    set((state) => {
      if (sessionId === null) {
        return {
          sessionId: null,
          messages: []
        }
      }

      if (state.paused && state.sessionId === sessionId) {
        return state
      }

      if (state.sessionId !== sessionId) {
        return {
          sessionId,
          messages: trimMessages(messages),
          filters: {
            direction: 'all',
            method: '',
            search: ''
          }
        }
      }

      return {
        sessionId,
        messages: appendNewMessages(state.messages, messages)
      }
    })
  },

  togglePaused: () => {
    set((state) => ({ paused: !state.paused }))
  },

  clearMessages: () => {
    set({ messages: [] })
  },

  setDirectionFilter: (direction) => {
    set((state) => ({
      filters: {
        ...state.filters,
        direction
      }
    }))
  },

  setMethodFilter: (method) => {
    set((state) => ({
      filters: {
        ...state.filters,
        method
      }
    }))
  },

  setSearchFilter: (search) => {
    set((state) => ({
      filters: {
        ...state.filters,
        search
      }
    }))
  }
}))
