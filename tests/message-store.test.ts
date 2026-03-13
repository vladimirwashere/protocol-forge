import { beforeEach, describe, expect, it } from 'vitest'

import type { SessionMessage } from '../src/shared/ipc'
import { useMessageStore } from '../src/renderer/src/stores/message-store'

const createMessage = (id: number, method = 'tools/call'): SessionMessage => ({
  id,
  sessionId: 'session-1',
  direction: id % 2 === 0 ? 'inbound' : 'outbound',
  payload: { method, id },
  createdAt: new Date(2026, 2, 13, 0, 0, id).toISOString()
})

describe('message-store', () => {
  beforeEach(() => {
    useMessageStore.setState(useMessageStore.getInitialState(), true)
  })

  it('ingests and appends only unseen message ids for the same session', () => {
    const store = useMessageStore.getState()

    store.ingestMessages('session-1', [createMessage(1), createMessage(2)])
    store.ingestMessages('session-1', [createMessage(2), createMessage(3)])

    const state = useMessageStore.getState()
    expect(state.messages.map((message) => message.id)).toEqual([1, 2, 3])
  })

  it('resets buffer when session changes', () => {
    const store = useMessageStore.getState()

    store.ingestMessages('session-1', [createMessage(1), createMessage(2)])
    store.ingestMessages('session-2', [{ ...createMessage(10), sessionId: 'session-2' }])

    const state = useMessageStore.getState()
    expect(state.sessionId).toBe('session-2')
    expect(state.messages.map((message) => message.id)).toEqual([10])
  })

  it('pauses ingestion for the active session', () => {
    const store = useMessageStore.getState()

    store.ingestMessages('session-1', [createMessage(1)])
    store.togglePaused()
    store.ingestMessages('session-1', [createMessage(2)])

    const pausedState = useMessageStore.getState()
    expect(pausedState.messages.map((message) => message.id)).toEqual([1])

    pausedState.togglePaused()
    pausedState.ingestMessages('session-1', [createMessage(2)])

    const resumedState = useMessageStore.getState()
    expect(resumedState.messages.map((message) => message.id)).toEqual([1, 2])
  })

  it('clears messages when session id is null', () => {
    const store = useMessageStore.getState()

    store.ingestMessages('session-1', [createMessage(1)])
    store.ingestMessages(null, [])

    const state = useMessageStore.getState()
    expect(state.sessionId).toBeNull()
    expect(state.messages).toEqual([])
  })
})
