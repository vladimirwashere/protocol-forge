import { describe, expect, it, vi } from 'vitest'
import { LoggingMessageNotificationSchema } from '@modelcontextprotocol/sdk/types.js'

import {
  LogNotificationsBus,
  registerLogNotificationHandler,
  setLoggingLevel
} from '../src/main/mcp/session/logging'
import type { LogNotification } from '../src/shared/ipc'

type NotificationHandlerFn = (notification: unknown) => unknown

describe('LogNotificationsBus', () => {
  it('emit() fans out to every listener', () => {
    const bus = new LogNotificationsBus()
    const a = vi.fn()
    const b = vi.fn()
    bus.onNotification(a)
    bus.onNotification(b)

    const note: LogNotification = {
      sessionId: 's1',
      level: 'info',
      data: 'hi',
      at: '2026-05-13T10:00:00.000Z'
    }
    bus.emit(note)

    expect(a).toHaveBeenCalledWith(note)
    expect(b).toHaveBeenCalledWith(note)
  })

  it('unsubscribe stops further notifications', () => {
    const bus = new LogNotificationsBus()
    const listener = vi.fn()
    const off = bus.onNotification(listener)
    bus.emit({ sessionId: 's1', level: 'info', data: 'x', at: 't' })
    off()
    bus.emit({ sessionId: 's1', level: 'info', data: 'y', at: 't' })
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('registerLogNotificationHandler', () => {
  function setup(): {
    bus: LogNotificationsBus
    handler: NotificationHandlerFn
    emitted: LogNotification[]
  } {
    const bus = new LogNotificationsBus()
    const setNotificationHandler =
      vi.fn<(schema: unknown, handler: NotificationHandlerFn) => void>()
    const client = { setNotificationHandler } as unknown as Parameters<
      typeof registerLogNotificationHandler
    >[0]
    registerLogNotificationHandler(client, 'sess-1', bus)

    expect(setNotificationHandler).toHaveBeenCalledTimes(1)
    expect(setNotificationHandler.mock.calls[0][0]).toBe(LoggingMessageNotificationSchema)
    const handler = setNotificationHandler.mock.calls[0][1]
    const emitted: LogNotification[] = []
    bus.onNotification((n) => emitted.push(n))
    return { bus, handler, emitted }
  }

  it('projects level, logger, data, and assigns the session id', () => {
    const { handler, emitted } = setup()
    handler({
      method: 'notifications/message',
      params: { level: 'warning', logger: 'mcp', data: { msg: 'hi' } }
    })

    expect(emitted).toHaveLength(1)
    expect(emitted[0].sessionId).toBe('sess-1')
    expect(emitted[0].level).toBe('warning')
    expect(emitted[0].logger).toBe('mcp')
    expect(emitted[0].data).toEqual({ msg: 'hi' })
    expect(typeof emitted[0].at).toBe('string')
  })

  it('omits logger when not a string', () => {
    const { handler, emitted } = setup()
    handler({
      method: 'notifications/message',
      params: { level: 'info', data: 'no logger' }
    })

    expect(emitted).toHaveLength(1)
    expect('logger' in emitted[0]).toBe(false)
  })

  it('drops notifications whose level is not in the fixed enum', () => {
    const { handler, emitted } = setup()
    handler({
      method: 'notifications/message',
      params: { level: 'verbose', data: 'x' }
    })
    expect(emitted).toHaveLength(0)
  })

  it('passes unknown data shapes through untouched', () => {
    const { handler, emitted } = setup()
    handler({
      method: 'notifications/message',
      params: { level: 'debug', data: 123 }
    })
    expect(emitted[0].data).toBe(123)
  })
})

describe('setLoggingLevel', () => {
  it('forwards the level to client.setLoggingLevel', async () => {
    const setLevel = vi.fn(async () => ({}))
    const client = { setLoggingLevel: setLevel } as unknown as Parameters<typeof setLoggingLevel>[0]
    await setLoggingLevel(client, 'warning')
    expect(setLevel).toHaveBeenCalledWith('warning')
  })
})
