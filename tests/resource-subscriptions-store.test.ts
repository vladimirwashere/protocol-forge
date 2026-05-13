import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DiscoveryResourceSubscriptionInput } from '../src/shared/ipc'
import { useResourceSubscriptionsStore } from '../src/renderer/src/stores/resource-subscriptions-store'

type MockApi = {
  subscribeResource: ReturnType<
    typeof vi.fn<(input: DiscoveryResourceSubscriptionInput) => Promise<{ ok: true }>>
  >
  unsubscribeResource: ReturnType<
    typeof vi.fn<(input: DiscoveryResourceSubscriptionInput) => Promise<{ ok: true }>>
  >
}

const setupWindowApi = (): MockApi => {
  const api: MockApi = {
    subscribeResource: vi.fn(async () => ({ ok: true })),
    unsubscribeResource: vi.fn(async () => ({ ok: true }))
  }
  ;(globalThis as unknown as { window: { api: MockApi } }).window = { api }
  return api
}

describe('resource-subscriptions-store', () => {
  beforeEach(() => {
    useResourceSubscriptionsStore.setState(useResourceSubscriptionsStore.getInitialState(), true)
  })

  it('subscribe() records entry with pending=false on success', async () => {
    const api = setupWindowApi()
    await useResourceSubscriptionsStore.getState().subscribe('sess-1', 'res://a')

    expect(api.subscribeResource).toHaveBeenCalledWith({ sessionId: 'sess-1', uri: 'res://a' })
    const entry = useResourceSubscriptionsStore.getState().get('sess-1', 'res://a')
    expect(entry).toEqual({ pending: false, lastUpdateAt: null })
    expect(useResourceSubscriptionsStore.getState().isSubscribed('sess-1', 'res://a')).toBe(true)
  })

  it('subscribe() drops entry and records error on failure', async () => {
    const api = setupWindowApi()
    api.subscribeResource.mockRejectedValueOnce(new Error('not supported'))

    await useResourceSubscriptionsStore.getState().subscribe('sess-1', 'res://a')

    const state = useResourceSubscriptionsStore.getState()
    expect(state.isSubscribed('sess-1', 'res://a')).toBe(false)
    expect(state.error).toBe('not supported')
  })

  it('unsubscribe() removes entry on success', async () => {
    setupWindowApi()
    await useResourceSubscriptionsStore.getState().subscribe('sess-1', 'res://a')
    await useResourceSubscriptionsStore.getState().unsubscribe('sess-1', 'res://a')

    expect(useResourceSubscriptionsStore.getState().isSubscribed('sess-1', 'res://a')).toBe(false)
  })

  it('unsubscribe() keeps entry but clears pending on failure', async () => {
    const api = setupWindowApi()
    await useResourceSubscriptionsStore.getState().subscribe('sess-1', 'res://a')
    api.unsubscribeResource.mockRejectedValueOnce(new Error('network'))

    await useResourceSubscriptionsStore.getState().unsubscribe('sess-1', 'res://a')

    const state = useResourceSubscriptionsStore.getState()
    expect(state.isSubscribed('sess-1', 'res://a')).toBe(true)
    expect(state.get('sess-1', 'res://a')).toEqual({ pending: false, lastUpdateAt: null })
    expect(state.error).toBe('network')
  })

  it('markUpdated() updates lastUpdateAt only for active subscriptions', async () => {
    setupWindowApi()
    await useResourceSubscriptionsStore.getState().subscribe('sess-1', 'res://a')

    useResourceSubscriptionsStore
      .getState()
      .markUpdated('sess-1', 'res://a', '2026-05-13T10:00:00.000Z')
    expect(useResourceSubscriptionsStore.getState().get('sess-1', 'res://a')).toEqual({
      pending: false,
      lastUpdateAt: '2026-05-13T10:00:00.000Z'
    })

    // Stale event for a URI we never subscribed to must be ignored.
    useResourceSubscriptionsStore
      .getState()
      .markUpdated('sess-1', 'res://stale', '2026-05-13T10:01:00.000Z')
    expect(useResourceSubscriptionsStore.getState().get('sess-1', 'res://stale')).toBeUndefined()
  })

  it('clearSession() drops all entries for that session only', async () => {
    setupWindowApi()
    await useResourceSubscriptionsStore.getState().subscribe('sess-1', 'res://a')
    await useResourceSubscriptionsStore.getState().subscribe('sess-1', 'res://b')
    await useResourceSubscriptionsStore.getState().subscribe('sess-2', 'res://c')

    useResourceSubscriptionsStore.getState().clearSession('sess-1')

    const state = useResourceSubscriptionsStore.getState()
    expect(state.isSubscribed('sess-1', 'res://a')).toBe(false)
    expect(state.isSubscribed('sess-1', 'res://b')).toBe(false)
    expect(state.isSubscribed('sess-2', 'res://c')).toBe(true)
  })

  it('preserves lastUpdateAt across resubscribe without intervening clear', async () => {
    setupWindowApi()
    await useResourceSubscriptionsStore.getState().subscribe('sess-1', 'res://a')
    useResourceSubscriptionsStore
      .getState()
      .markUpdated('sess-1', 'res://a', '2026-05-13T10:00:00.000Z')

    // Resubscribing should not wipe the prior timestamp.
    await useResourceSubscriptionsStore.getState().subscribe('sess-1', 'res://a')
    expect(useResourceSubscriptionsStore.getState().get('sess-1', 'res://a')).toEqual({
      pending: false,
      lastUpdateAt: '2026-05-13T10:00:00.000Z'
    })
  })
})
