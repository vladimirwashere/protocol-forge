import { describe, expect, it, vi } from 'vitest'
import { ResourceUpdatedNotificationSchema } from '@modelcontextprotocol/sdk/types.js'

import {
  ResourceSubscriptionsStore,
  registerResourceUpdatedHandler
} from '../src/main/mcp/session/resource-subscriptions'

type NotificationHandlerFn = (notification: unknown) => unknown

describe('ResourceSubscriptionsStore', () => {
  it('add() inserts entry, dedupes, and emits change once per insert', () => {
    const store = new ResourceSubscriptionsStore()
    const onChange = vi.fn()
    store.onChange(onChange)

    expect(store.add('s1', 'res://a')).toBe(true)
    expect(store.add('s1', 'res://a')).toBe(false)
    expect(store.size()).toBe(1)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('remove() drops entry and reports whether anything changed', () => {
    const store = new ResourceSubscriptionsStore()
    store.add('s1', 'res://a')

    expect(store.remove('s1', 'res://a')).toBe(true)
    expect(store.remove('s1', 'res://a')).toBe(false)
    expect(store.size()).toBe(0)
  })

  it('has() and listForSession() scope correctly by session', () => {
    const store = new ResourceSubscriptionsStore()
    store.add('s1', 'res://a')
    store.add('s1', 'res://b')
    store.add('s2', 'res://c')

    expect(store.has('s1', 'res://a')).toBe(true)
    expect(store.has('s1', 'res://c')).toBe(false)
    expect(store.listForSession('s1').sort()).toEqual(['res://a', 'res://b'])
    expect(store.listForSession('s2')).toEqual(['res://c'])
  })

  it('removeBySession() drops all entries for that session and notifies once', () => {
    const store = new ResourceSubscriptionsStore()
    const onChange = vi.fn()
    store.add('s1', 'res://a')
    store.add('s1', 'res://b')
    store.add('s2', 'res://c')
    store.onChange(onChange)

    const removed = store.removeBySession('s1').sort()
    expect(removed).toEqual(['res://a', 'res://b'])
    expect(store.size()).toBe(1)
    expect(store.has('s2', 'res://c')).toBe(true)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('removeBySession() emits no change when nothing matched', () => {
    const store = new ResourceSubscriptionsStore()
    store.add('s1', 'res://a')
    const onChange = vi.fn()
    store.onChange(onChange)

    expect(store.removeBySession('other')).toEqual([])
    expect(onChange).not.toHaveBeenCalled()
  })

  it('onChange() unsubscribe stops further notifications', () => {
    const store = new ResourceSubscriptionsStore()
    const onChange = vi.fn()
    const off = store.onChange(onChange)
    store.add('s1', 'res://a')
    off()
    store.add('s1', 'res://b')
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})

describe('registerResourceUpdatedHandler', () => {
  it('emits update only for URIs the session is still subscribed to', () => {
    const store = new ResourceSubscriptionsStore()
    const setNotificationHandler =
      vi.fn<(schema: unknown, handler: NotificationHandlerFn) => void>()
    const client = { setNotificationHandler } as unknown as Parameters<
      typeof registerResourceUpdatedHandler
    >[0]

    registerResourceUpdatedHandler(client, 'sess-1', store)
    expect(setNotificationHandler).toHaveBeenCalledTimes(1)
    expect(setNotificationHandler.mock.calls[0][0]).toBe(ResourceUpdatedNotificationSchema)

    const handler = setNotificationHandler.mock.calls[0][1]
    const updates: Array<{ sessionId: string; uri: string; at: string }> = []
    store.onUpdate((update) => updates.push(update))

    // Not subscribed yet — should be dropped.
    handler({ method: 'notifications/resources/updated', params: { uri: 'res://a' } })
    expect(updates).toEqual([])

    // Subscribe and try again.
    store.add('sess-1', 'res://a')
    handler({ method: 'notifications/resources/updated', params: { uri: 'res://a' } })
    expect(updates).toHaveLength(1)
    expect(updates[0].sessionId).toBe('sess-1')
    expect(updates[0].uri).toBe('res://a')
    expect(typeof updates[0].at).toBe('string')

    // Unsubscribe — late events drop on the floor.
    store.remove('sess-1', 'res://a')
    handler({ method: 'notifications/resources/updated', params: { uri: 'res://a' } })
    expect(updates).toHaveLength(1)
  })

  it('ignores updates for other sessions sharing the same store', () => {
    const store = new ResourceSubscriptionsStore()
    const setNotificationHandler =
      vi.fn<(schema: unknown, handler: NotificationHandlerFn) => void>()
    const client = { setNotificationHandler } as unknown as Parameters<
      typeof registerResourceUpdatedHandler
    >[0]

    registerResourceUpdatedHandler(client, 'sess-1', store)
    const handler = setNotificationHandler.mock.calls[0][1]

    store.add('sess-2', 'res://a')
    const updates: Array<{ sessionId: string; uri: string; at: string }> = []
    store.onUpdate((update) => updates.push(update))

    handler({ method: 'notifications/resources/updated', params: { uri: 'res://a' } })
    expect(updates).toEqual([])
  })
})
