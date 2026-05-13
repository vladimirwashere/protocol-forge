import { describe, expect, it, vi } from 'vitest'

import { complete } from '../src/main/mcp/session/discovery'

type CompleteParams = {
  ref: { type: 'ref/prompt'; name: string } | { type: 'ref/resource'; uri: string }
  argument: { name: string; value: string }
  context?: { arguments?: Record<string, string> }
}

type FakeClient = {
  complete: ReturnType<typeof vi.fn>
}

function buildClient(
  values: string[],
  extras: { total?: number; hasMore?: boolean } = {}
): FakeClient {
  const client: FakeClient = {
    complete: vi.fn(async () => ({
      completion: { values, ...extras }
    }))
  }
  return client
}

describe('discovery.complete', () => {
  it('forwards prompt ref and argument and returns projected values', async () => {
    const client = buildClient(['alpha', 'beta'])
    const result = await complete(client as unknown as Parameters<typeof complete>[0], {
      sessionId: 's',
      ref: { type: 'ref/prompt', name: 'greet' },
      argument: { name: 'tone', value: 'al' }
    })

    expect(client.complete).toHaveBeenCalledTimes(1)
    const params = (client.complete.mock.calls[0]?.[0] ?? {}) as CompleteParams
    expect(params.ref).toEqual({ type: 'ref/prompt', name: 'greet' })
    expect(params.argument).toEqual({ name: 'tone', value: 'al' })
    expect(params.context).toBeUndefined()
    expect(result).toEqual({ values: ['alpha', 'beta'] })
  })

  it('forwards context.arguments when provided', async () => {
    const client = buildClient([])
    await complete(client as unknown as Parameters<typeof complete>[0], {
      sessionId: 's',
      ref: { type: 'ref/resource', uri: 'file://x' },
      argument: { name: 'name', value: 'a' },
      context: { arguments: { kind: 'doc' } }
    })

    const params = (client.complete.mock.calls[0]?.[0] ?? {}) as CompleteParams
    expect(params.context).toEqual({ arguments: { kind: 'doc' } })
  })

  it('projects total and hasMore when present', async () => {
    const client = buildClient(['x'], { total: 5, hasMore: true })
    const result = await complete(client as unknown as Parameters<typeof complete>[0], {
      sessionId: 's',
      ref: { type: 'ref/prompt', name: 'p' },
      argument: { name: 'a', value: '' }
    })
    expect(result).toEqual({ values: ['x'], total: 5, hasMore: true })
  })

  it('omits total/hasMore when missing from response', async () => {
    const client: FakeClient = {
      complete: vi.fn(async () => ({ completion: { values: [] } }))
    }
    const result = await complete(client as unknown as Parameters<typeof complete>[0], {
      sessionId: 's',
      ref: { type: 'ref/prompt', name: 'p' },
      argument: { name: 'a', value: '' }
    })
    expect(result).toEqual({ values: [] })
    expect('total' in result).toBe(false)
    expect('hasMore' in result).toBe(false)
  })
})
