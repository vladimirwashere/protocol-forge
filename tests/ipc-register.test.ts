import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

type Handler = (event: unknown, raw: unknown) => unknown

const handlers = new Map<string, Handler>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Handler) => {
      handlers.set(channel, handler)
    },
    removeHandler: (channel: string) => {
      handlers.delete(channel)
    }
  }
}))

import { registerIpcHandler, registerIpcHandlerNoInput } from '../src/main/ipc/register'
import { AppError } from '../src/shared/errors'

describe('registerIpcHandler', () => {
  beforeEach(() => {
    handlers.clear()
  })

  it('validates input and invokes the handler with parsed data', async () => {
    const schema = z.object({ sessionId: z.string() })
    const handler = vi.fn((input: { sessionId: string }) => ({ ok: true, id: input.sessionId }))

    registerIpcHandler('test:channel', schema, handler)

    const registered = handlers.get('test:channel')
    expect(registered).toBeDefined()

    const event = { sender: { id: 1 } }
    const result = await registered!(event, { sessionId: 'abc' })

    expect(handler).toHaveBeenCalledWith({ sessionId: 'abc' }, event)
    expect(result).toEqual({ ok: true, id: 'abc' })
  })

  it('throws AppError(INVALID_INPUT) when the schema rejects input', () => {
    const schema = z.object({ sessionId: z.string() })
    const handler = vi.fn()

    registerIpcHandler('test:channel', schema, handler)
    const registered = handlers.get('test:channel')!

    let caught: unknown
    try {
      registered({ sender: { id: 1 } }, { sessionId: 42 })
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(AppError)
    expect((caught as AppError).code).toBe('INVALID_INPUT')
    expect((caught as AppError).details).toEqual({ channel: 'test:channel' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('rejects undefined input when schema requires an object', () => {
    const schema = z.object({ sessionId: z.string() })
    registerIpcHandler('test:channel', schema, () => undefined)
    const registered = handlers.get('test:channel')!

    expect(() => registered({ sender: { id: 1 } }, undefined)).toThrow(AppError)
  })

  it('accepts undefined when schema uses .default({})', () => {
    const schema = z.object({ limit: z.number().optional() }).default({})
    const handler = vi.fn((input: { limit?: number }) => input)

    registerIpcHandler('test:channel', schema, handler)
    const registered = handlers.get('test:channel')!

    const result = registered({ sender: { id: 1 } }, undefined)
    expect(result).toEqual({})
    expect(handler).toHaveBeenCalledWith({}, expect.anything())
  })
})

describe('registerIpcHandlerNoInput', () => {
  beforeEach(() => {
    handlers.clear()
  })

  it('invokes the handler without parsing input', () => {
    const handler = vi.fn(() => ({ ok: true }))

    registerIpcHandlerNoInput('test:no-input', handler)
    const registered = handlers.get('test:no-input')!

    const event = { sender: { id: 2 } }
    const result = registered(event, { anything: 'ignored' })

    expect(handler).toHaveBeenCalledWith(event)
    expect(result).toEqual({ ok: true })
  })
})
