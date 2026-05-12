import { describe, expect, it, vi } from 'vitest'
import {
  ElicitRequestSchema,
  ElicitationCompleteNotificationSchema
} from '@modelcontextprotocol/sdk/types.js'

import {
  PendingElicitationStore,
  registerElicitationHandler
} from '../src/main/mcp/session/elicitation'

type RequestHandlerFn = (request: unknown, extra: unknown) => unknown
type NotificationHandlerFn = (notification: unknown) => unknown

const formParams = {
  message: 'Pick a flavor',
  requestedSchema: {
    type: 'object',
    properties: {
      flavor: { type: 'string', enum: ['vanilla', 'chocolate'] }
    }
  }
}

const urlParams = {
  mode: 'url' as const,
  message: 'Authorize via browser',
  elicitationId: 'elc-1',
  url: 'https://example.test/authorize'
}

describe('PendingElicitationStore', () => {
  it('add() inserts entry and emits change', () => {
    const store = new PendingElicitationStore()
    const onChange = vi.fn()
    store.onChange(onChange)

    store.add({
      requestId: 'req-1',
      sessionId: 'sess-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      mode: 'form',
      message: 'hello',
      requestedSchema: { type: 'object', properties: {} },
      resolve: vi.fn(),
      reject: vi.fn()
    })

    expect(store.list()).toEqual([
      {
        requestId: 'req-1',
        sessionId: 'sess-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        mode: 'form',
        message: 'hello',
        requestedSchema: { type: 'object', properties: {} }
      }
    ])
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('add() rejects duplicate requestId', () => {
    const store = new PendingElicitationStore()
    const entry = {
      requestId: 'dup',
      sessionId: 's',
      createdAt: 't',
      mode: 'form' as const,
      message: 'm',
      resolve: vi.fn(),
      reject: vi.fn()
    }
    store.add(entry)
    expect(() => store.add(entry)).toThrow(/Duplicate elicitation requestId/)
  })

  it('respond(accept) resolves with content and removes the entry', () => {
    const store = new PendingElicitationStore()
    const resolve = vi.fn()
    const reject = vi.fn()

    store.add({
      requestId: 'r1',
      sessionId: 's',
      createdAt: 't',
      mode: 'form',
      message: 'm',
      resolve,
      reject
    })

    const found = store.respond({
      requestId: 'r1',
      action: 'accept',
      content: { flavor: 'vanilla' }
    })

    expect(found).toBe(true)
    expect(resolve).toHaveBeenCalledWith({ action: 'accept', content: { flavor: 'vanilla' } })
    expect(reject).not.toHaveBeenCalled()
    expect(store.list()).toEqual([])
  })

  it('respond(decline) resolves without content', () => {
    const store = new PendingElicitationStore()
    const resolve = vi.fn()

    store.add({
      requestId: 'r1',
      sessionId: 's',
      createdAt: 't',
      mode: 'form',
      message: 'm',
      resolve,
      reject: vi.fn()
    })

    store.respond({ requestId: 'r1', action: 'decline' })

    expect(resolve).toHaveBeenCalledWith({ action: 'decline' })
  })

  it('respond() returns false for unknown requestId', () => {
    const store = new PendingElicitationStore()
    expect(store.respond({ requestId: 'nope', action: 'cancel' })).toBe(false)
  })

  it('rejectBySession() drops all entries for that session and notifies once', () => {
    const store = new PendingElicitationStore()
    const onChange = vi.fn()
    const rejectA = vi.fn()
    const rejectB = vi.fn()
    const rejectOther = vi.fn()

    store.add({
      requestId: 'a',
      sessionId: 's1',
      createdAt: 't',
      mode: 'form',
      message: 'm',
      resolve: vi.fn(),
      reject: rejectA
    })
    store.add({
      requestId: 'b',
      sessionId: 's1',
      createdAt: 't',
      mode: 'form',
      message: 'm',
      resolve: vi.fn(),
      reject: rejectB
    })
    store.add({
      requestId: 'c',
      sessionId: 's2',
      createdAt: 't',
      mode: 'form',
      message: 'm',
      resolve: vi.fn(),
      reject: rejectOther
    })

    store.onChange(onChange)
    store.rejectBySession('s1', new Error('boom'))

    expect(rejectA).toHaveBeenCalledTimes(1)
    expect(rejectB).toHaveBeenCalledTimes(1)
    expect(rejectOther).not.toHaveBeenCalled()
    expect(store.list().map((e) => e.requestId)).toEqual(['c'])
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('completeByElicitationId resolves matching URL-mode entry as accept', () => {
    const store = new PendingElicitationStore()
    const resolve = vi.fn()

    store.add({
      requestId: 'req-1',
      sessionId: 's1',
      createdAt: 't',
      mode: 'url',
      message: 'auth',
      elicitationId: 'elc-1',
      url: 'https://example.test/x',
      resolve,
      reject: vi.fn()
    })

    expect(store.completeByElicitationId('s1', 'elc-1')).toBe(true)
    expect(resolve).toHaveBeenCalledWith({ action: 'accept' })
    expect(store.list()).toEqual([])
  })

  it('completeByElicitationId returns false when no entry matches', () => {
    const store = new PendingElicitationStore()
    expect(store.completeByElicitationId('s', 'missing')).toBe(false)
  })
})

describe('registerElicitationHandler', () => {
  it('registers form-mode request handler and resolves on respond', async () => {
    const store = new PendingElicitationStore()
    const setRequestHandler = vi.fn<(schema: unknown, handler: RequestHandlerFn) => void>()
    const setNotificationHandler =
      vi.fn<(schema: unknown, handler: NotificationHandlerFn) => void>()
    const client = { setRequestHandler, setNotificationHandler } as unknown as Parameters<
      typeof registerElicitationHandler
    >[0]

    let counter = 0
    registerElicitationHandler(client, 'sess-1', store, () => `req-${++counter}`)

    expect(setRequestHandler).toHaveBeenCalledTimes(1)
    expect(setRequestHandler.mock.calls[0][0]).toBe(ElicitRequestSchema)
    expect(setNotificationHandler).toHaveBeenCalledTimes(1)
    expect(setNotificationHandler.mock.calls[0][0]).toBe(ElicitationCompleteNotificationSchema)

    const requestHandler = setRequestHandler.mock.calls[0][1]
    const promise = requestHandler(
      { method: 'elicitation/create', params: formParams },
      {}
    ) as Promise<unknown>

    const pending = store.list()
    expect(pending).toHaveLength(1)
    expect(pending[0].mode).toBe('form')
    expect(pending[0].requestId).toBe('req-1')
    expect(pending[0].message).toBe('Pick a flavor')

    store.respond({ requestId: 'req-1', action: 'accept', content: { flavor: 'vanilla' } })

    await expect(promise).resolves.toEqual({
      action: 'accept',
      content: { flavor: 'vanilla' }
    })
  })

  it('URL-mode request waits and completion notification resolves it', async () => {
    const store = new PendingElicitationStore()
    const setRequestHandler = vi.fn<(schema: unknown, handler: RequestHandlerFn) => void>()
    const setNotificationHandler =
      vi.fn<(schema: unknown, handler: NotificationHandlerFn) => void>()
    const client = { setRequestHandler, setNotificationHandler } as unknown as Parameters<
      typeof registerElicitationHandler
    >[0]

    registerElicitationHandler(client, 'sess-1', store, () => 'req-1')

    const requestHandler = setRequestHandler.mock.calls[0][1]
    const promise = requestHandler(
      { method: 'elicitation/create', params: urlParams },
      {}
    ) as Promise<unknown>

    const pending = store.list()
    expect(pending).toHaveLength(1)
    expect(pending[0].mode).toBe('url')
    expect(pending[0].url).toBe(urlParams.url)
    expect(pending[0].elicitationId).toBe(urlParams.elicitationId)

    const notificationHandler = setNotificationHandler.mock.calls[0][1]
    notificationHandler({
      method: 'notifications/elicitation/complete',
      params: { elicitationId: urlParams.elicitationId }
    })

    await expect(promise).resolves.toEqual({ action: 'accept' })
    expect(store.list()).toEqual([])
  })
})
