import { describe, expect, it, vi } from 'vitest'
import { CreateMessageRequestSchema } from '@modelcontextprotocol/sdk/types.js'

import { PendingSamplingStore, registerSamplingHandler } from '../src/main/mcp/session/sampling'

type HandlerFn = (request: unknown, extra: unknown) => unknown

const sampleParams = {
  messages: [{ role: 'user' as const, content: { type: 'text' as const, text: 'hi' } }],
  maxTokens: 64
}

describe('PendingSamplingStore', () => {
  it('add() inserts entry and emits change', () => {
    const store = new PendingSamplingStore()
    const onChange = vi.fn()
    store.onChange(onChange)

    store.add({
      requestId: 'req-1',
      sessionId: 'sess-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      params: sampleParams,
      resolve: vi.fn(),
      reject: vi.fn()
    })

    expect(store.list()).toEqual([
      {
        requestId: 'req-1',
        sessionId: 'sess-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        params: sampleParams
      }
    ])
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('add() rejects duplicate requestId', () => {
    const store = new PendingSamplingStore()
    const entry = {
      requestId: 'dup',
      sessionId: 's',
      createdAt: 't',
      params: {},
      resolve: vi.fn(),
      reject: vi.fn()
    }
    store.add(entry)
    expect(() => store.add(entry)).toThrow(/Duplicate sampling requestId/)
  })

  it('respond() resolves the awaited promise and removes the entry', async () => {
    const store = new PendingSamplingStore()
    const resolve = vi.fn()
    const reject = vi.fn()

    store.add({
      requestId: 'r1',
      sessionId: 's1',
      createdAt: 't',
      params: sampleParams,
      resolve,
      reject
    })

    const found = store.respond({
      requestId: 'r1',
      model: 'mock-1',
      role: 'assistant',
      content: { type: 'text', text: 'reply' },
      stopReason: 'endTurn'
    })

    expect(found).toBe(true)
    expect(resolve).toHaveBeenCalledWith({
      model: 'mock-1',
      role: 'assistant',
      content: { type: 'text', text: 'reply' },
      stopReason: 'endTurn'
    })
    expect(reject).not.toHaveBeenCalled()
    expect(store.list()).toEqual([])
  })

  it('respond() omits stopReason when not provided', () => {
    const store = new PendingSamplingStore()
    const resolve = vi.fn()

    store.add({
      requestId: 'r1',
      sessionId: 's1',
      createdAt: 't',
      params: sampleParams,
      resolve,
      reject: vi.fn()
    })

    store.respond({
      requestId: 'r1',
      model: 'mock',
      role: 'assistant',
      content: { type: 'text', text: 'ok' }
    })

    const result = resolve.mock.calls[0][0]
    expect(result).not.toHaveProperty('stopReason')
  })

  it('respond() returns false for unknown requestId', () => {
    const store = new PendingSamplingStore()
    expect(
      store.respond({
        requestId: 'nope',
        model: 'm',
        role: 'assistant',
        content: { type: 'text', text: '' }
      })
    ).toBe(false)
  })

  it('reject() rejects the awaited promise with the message', () => {
    const store = new PendingSamplingStore()
    const reject = vi.fn()

    store.add({
      requestId: 'r',
      sessionId: 's',
      createdAt: 't',
      params: {},
      resolve: vi.fn(),
      reject
    })

    const found = store.reject({ requestId: 'r', message: 'no thanks', code: -32603 })
    expect(found).toBe(true)
    expect(reject).toHaveBeenCalledTimes(1)
    const error = reject.mock.calls[0][0] as Error & { code?: number }
    expect(error.message).toBe('no thanks')
    expect(error.code).toBe(-32603)
    expect(store.list()).toEqual([])
  })

  it('rejectBySession() drops all entries for that session and notifies once', () => {
    const store = new PendingSamplingStore()
    const onChange = vi.fn()
    const rejectA = vi.fn()
    const rejectB = vi.fn()
    const rejectOther = vi.fn()

    store.add({
      requestId: 'a',
      sessionId: 's1',
      createdAt: 't',
      params: {},
      resolve: vi.fn(),
      reject: rejectA
    })
    store.add({
      requestId: 'b',
      sessionId: 's1',
      createdAt: 't',
      params: {},
      resolve: vi.fn(),
      reject: rejectB
    })
    store.add({
      requestId: 'c',
      sessionId: 's2',
      createdAt: 't',
      params: {},
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

  it('rejectBySession() with no matches does not emit', () => {
    const store = new PendingSamplingStore()
    const onChange = vi.fn()
    store.onChange(onChange)
    store.rejectBySession('nope', new Error('x'))
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('registerSamplingHandler', () => {
  it('registers a sampling/createMessage handler that adds a pending entry and awaits a resolution', async () => {
    const store = new PendingSamplingStore()
    const setRequestHandler = vi.fn<(schema: unknown, handler: HandlerFn) => void>()
    const client = { setRequestHandler } as unknown as Parameters<typeof registerSamplingHandler>[0]
    let counter = 0
    const generateId = (): string => `req-${++counter}`

    registerSamplingHandler(client, 'sess-1', store, generateId)

    expect(setRequestHandler).toHaveBeenCalledTimes(1)
    expect(setRequestHandler.mock.calls[0][0]).toBe(CreateMessageRequestSchema)

    const handler = setRequestHandler.mock.calls[0][1]
    const promise = handler({ method: 'sampling/createMessage', params: sampleParams }, {})

    const pending = store.list()
    expect(pending).toHaveLength(1)
    expect(pending[0].sessionId).toBe('sess-1')
    expect(pending[0].requestId).toBe('req-1')
    expect(pending[0].params).toEqual(sampleParams)

    store.respond({
      requestId: 'req-1',
      model: 'mock-model',
      role: 'assistant',
      content: { type: 'text', text: 'hello' }
    })

    await expect(promise).resolves.toEqual({
      model: 'mock-model',
      role: 'assistant',
      content: { type: 'text', text: 'hello' }
    })
  })
})
