import { describe, expect, it, vi } from 'vitest'
import { ListRootsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

import { notifyRootsChanged, registerRootsHandler } from '../src/main/mcp/session/roots'

type HandlerFn = (request: unknown, extra: unknown) => unknown

describe('session/roots', () => {
  it('registers a roots/list handler that returns the latest roots on each call', () => {
    let currentRoots = [{ uri: 'file:///a' }]
    const setRequestHandler = vi.fn<(schema: unknown, handler: HandlerFn) => void>()
    const client = { setRequestHandler } as unknown as Parameters<typeof registerRootsHandler>[0]

    registerRootsHandler(client, () => currentRoots)

    expect(setRequestHandler).toHaveBeenCalledTimes(1)
    expect(setRequestHandler.mock.calls[0][0]).toBe(ListRootsRequestSchema)

    const handler = setRequestHandler.mock.calls[0][1]
    expect(handler({}, {})).toEqual({ roots: [{ uri: 'file:///a' }] })

    currentRoots = [{ uri: 'file:///b', name: 'b' }, { uri: 'file:///c' }]
    expect(handler({}, {})).toEqual({
      roots: [{ uri: 'file:///b', name: 'b' }, { uri: 'file:///c' }]
    })
  })

  it('forwards notifyRootsChanged to client.sendRootsListChanged', async () => {
    const sendRootsListChanged = vi.fn().mockResolvedValue(undefined)
    const client = { sendRootsListChanged } as unknown as Parameters<typeof notifyRootsChanged>[0]

    await notifyRootsChanged(client)

    expect(sendRootsListChanged).toHaveBeenCalledTimes(1)
  })
})
