import { beforeEach, describe, expect, it, vi } from 'vitest'

import { isAtLeast, useLoggingStore } from '../src/renderer/src/stores/logging-store'
import type { LoggingSetLevelInput } from '../src/shared/ipc'

type MockApi = {
  setLoggingLevel: ReturnType<typeof vi.fn<(input: LoggingSetLevelInput) => Promise<{ ok: true }>>>
  subscribeLogNotifications: ReturnType<typeof vi.fn>
}

function setupWindowApi(): MockApi {
  const api: MockApi = {
    setLoggingLevel: vi.fn(async () => ({ ok: true })),
    subscribeLogNotifications: vi.fn(() => () => {})
  }
  ;(globalThis as unknown as { window: { api: MockApi } }).window = { api }
  return api
}

describe('isAtLeast', () => {
  it('treats higher-severity levels as passing the threshold', () => {
    expect(isAtLeast('error', 'warning')).toBe(true)
    expect(isAtLeast('debug', 'info')).toBe(false)
    expect(isAtLeast('info', 'info')).toBe(true)
    expect(isAtLeast('emergency', 'debug')).toBe(true)
  })
})

describe('useLoggingStore', () => {
  beforeEach(() => {
    setupWindowApi()
    useLoggingStore.setState(useLoggingStore.getInitialState(), true)
  })

  it('ingest() only stores notifications matching the active session', () => {
    useLoggingStore.getState().setActiveSession('sess-1')
    useLoggingStore.getState().ingest({
      sessionId: 'sess-1',
      level: 'info',
      data: 'a',
      at: 't1'
    })
    useLoggingStore.getState().ingest({
      sessionId: 'sess-2',
      level: 'info',
      data: 'b',
      at: 't2'
    })

    const entries = useLoggingStore.getState().entries
    expect(entries).toHaveLength(1)
    expect(entries[0].sessionId).toBe('sess-1')
    expect(entries[0].id).toBeGreaterThan(0)
  })

  it('ingest() drops everything when there is no active session', () => {
    useLoggingStore.getState().ingest({
      sessionId: 'sess-1',
      level: 'info',
      data: 'a',
      at: 't1'
    })
    expect(useLoggingStore.getState().entries).toHaveLength(0)
  })

  it('setActiveSession() resets buffer when switching sessions', () => {
    useLoggingStore.getState().setActiveSession('sess-1')
    useLoggingStore.getState().ingest({ sessionId: 'sess-1', level: 'info', data: 'a', at: 't' })
    expect(useLoggingStore.getState().entries).toHaveLength(1)

    useLoggingStore.getState().setActiveSession('sess-2')
    expect(useLoggingStore.getState().entries).toHaveLength(0)
  })

  it('applyLevelToServer() forwards to API and tracks pending state', async () => {
    const api = setupWindowApi()
    let resolve: () => void = () => {}
    api.setLoggingLevel.mockImplementationOnce(
      () =>
        new Promise<{ ok: true }>((res) => {
          resolve = () => res({ ok: true })
        })
    )

    const promise = useLoggingStore.getState().applyLevelToServer('sess-1', 'warning')
    expect(useLoggingStore.getState().setLevelPending).toBe(true)
    expect(useLoggingStore.getState().selectedLevel).toBe('warning')

    resolve()
    await promise
    expect(api.setLoggingLevel).toHaveBeenCalledWith({ sessionId: 'sess-1', level: 'warning' })
    expect(useLoggingStore.getState().setLevelPending).toBe(false)
    expect(useLoggingStore.getState().setLevelError).toBeNull()
  })

  it('applyLevelToServer() records error on failure', async () => {
    const api = setupWindowApi()
    api.setLoggingLevel.mockRejectedValueOnce(new Error('not supported'))

    await useLoggingStore.getState().applyLevelToServer('sess-1', 'debug')
    expect(useLoggingStore.getState().setLevelPending).toBe(false)
    expect(useLoggingStore.getState().setLevelError).toBe('not supported')
  })

  it('clear() empties the buffer without affecting filters', () => {
    useLoggingStore.getState().setActiveSession('sess-1')
    useLoggingStore.getState().setMinLevel('warning')
    useLoggingStore.getState().ingest({ sessionId: 'sess-1', level: 'info', data: 'a', at: 't' })

    useLoggingStore.getState().clear()
    expect(useLoggingStore.getState().entries).toHaveLength(0)
    expect(useLoggingStore.getState().minLevel).toBe('warning')
  })

  it('caps buffer at the bounded limit', () => {
    useLoggingStore.getState().setActiveSession('sess-1')
    for (let i = 0; i < 350; i += 1) {
      useLoggingStore.getState().ingest({ sessionId: 'sess-1', level: 'info', data: i, at: 't' })
    }
    const entries = useLoggingStore.getState().entries
    expect(entries.length).toBe(300)
    // The oldest entries should have been dropped.
    expect(entries[0].data).toBe(50)
    expect(entries.at(-1)?.data).toBe(349)
  })
})
