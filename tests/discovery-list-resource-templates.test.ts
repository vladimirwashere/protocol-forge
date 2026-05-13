import { describe, expect, it, vi } from 'vitest'

import { listResourceTemplates } from '../src/main/mcp/session/discovery'

type FakeClient = {
  listResourceTemplates: ReturnType<typeof vi.fn>
}

function buildClient(resourceTemplates: unknown): FakeClient {
  return {
    listResourceTemplates: vi.fn(async () => ({ resourceTemplates }))
  }
}

describe('discovery.listResourceTemplates', () => {
  it('projects required fields and drops missing optional fields', async () => {
    const client = buildClient([{ uriTemplate: 'file:///{path}', name: 'file-by-path' }])
    const result = await listResourceTemplates(
      client as unknown as Parameters<typeof listResourceTemplates>[0]
    )
    expect(result.resourceTemplates).toEqual([
      { uriTemplate: 'file:///{path}', name: 'file-by-path' }
    ])
  })

  it('includes title, description, mimeType, icons when valid', async () => {
    const client = buildClient([
      {
        uriTemplate: 'doc://{id}',
        name: 'doc',
        title: 'Document',
        description: 'A doc',
        mimeType: 'text/plain',
        icons: [{ src: 'a.png', mimeType: 'image/png', sizes: ['16x16'], theme: 'light' }]
      }
    ])
    const result = await listResourceTemplates(
      client as unknown as Parameters<typeof listResourceTemplates>[0]
    )
    expect(result.resourceTemplates[0]).toEqual({
      uriTemplate: 'doc://{id}',
      name: 'doc',
      title: 'Document',
      description: 'A doc',
      mimeType: 'text/plain',
      icons: [{ src: 'a.png', mimeType: 'image/png', sizes: ['16x16'], theme: 'light' }]
    })
  })

  it('drops entries with non-string uriTemplate or name', async () => {
    const client = buildClient([
      { uriTemplate: 'ok://{x}', name: 'ok' },
      { uriTemplate: 42, name: 'bad-template' },
      { uriTemplate: 'ok://{y}', name: 7 },
      null,
      'string-entry'
    ])
    const result = await listResourceTemplates(
      client as unknown as Parameters<typeof listResourceTemplates>[0]
    )
    expect(result.resourceTemplates).toEqual([{ uriTemplate: 'ok://{x}', name: 'ok' }])
  })

  it('drops wrong-typed optional fields without rejecting the entry', async () => {
    const client = buildClient([
      {
        uriTemplate: 'doc://{id}',
        name: 'doc',
        title: 42,
        description: null,
        mimeType: ['text/plain'],
        icons: 'not-an-array'
      }
    ])
    const result = await listResourceTemplates(
      client as unknown as Parameters<typeof listResourceTemplates>[0]
    )
    expect(result.resourceTemplates).toEqual([{ uriTemplate: 'doc://{id}', name: 'doc' }])
  })

  it('returns empty list when resourceTemplates is missing or not an array', async () => {
    const client = buildClient(undefined)
    const result = await listResourceTemplates(
      client as unknown as Parameters<typeof listResourceTemplates>[0]
    )
    expect(result).toEqual({ resourceTemplates: [] })
  })
})
