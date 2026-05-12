import { describe, expect, it } from 'vitest'

import { listTools } from '../src/main/mcp/session/discovery'

type FakeClient = { listTools: () => Promise<{ tools: unknown[] }> }

function buildClient(tools: unknown[]): FakeClient {
  return { listTools: () => Promise.resolve({ tools }) }
}

describe('listTools projection', () => {
  it('passes through name and inputSchema for a minimal tool', async () => {
    const client = buildClient([{ name: 'noop', inputSchema: { type: 'object' } }])
    const result = await listTools(client as unknown as Parameters<typeof listTools>[0])
    expect(result.tools).toEqual([{ name: 'noop', inputSchema: { type: 'object' } }])
  })

  it('picks up tool-level title and description', async () => {
    const client = buildClient([
      {
        name: 'echo',
        title: 'Echo Tool',
        description: 'Echoes the input',
        inputSchema: { type: 'object' }
      }
    ])
    const result = await listTools(client as unknown as Parameters<typeof listTools>[0])
    expect(result.tools[0]).toMatchObject({
      name: 'echo',
      title: 'Echo Tool',
      description: 'Echoes the input'
    })
  })

  it('projects only the recognized boolean annotation fields and the title', async () => {
    const client = buildClient([
      {
        name: 'wipe',
        inputSchema: { type: 'object' },
        annotations: {
          title: 'Wipe Disk',
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
          extraneousField: 'should-be-stripped',
          numericNoise: 42
        }
      }
    ])
    const result = await listTools(client as unknown as Parameters<typeof listTools>[0])
    expect(result.tools[0]?.annotations).toEqual({
      title: 'Wipe Disk',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true
    })
  })

  it('drops annotations entirely when no recognized field is present', async () => {
    const client = buildClient([
      {
        name: 't',
        inputSchema: { type: 'object' },
        annotations: { something: 'else' }
      }
    ])
    const result = await listTools(client as unknown as Parameters<typeof listTools>[0])
    expect(result.tools[0]).not.toHaveProperty('annotations')
  })

  it('coerces wrong-typed annotation fields to absence', async () => {
    const client = buildClient([
      {
        name: 't',
        inputSchema: { type: 'object' },
        annotations: {
          destructiveHint: 'true',
          readOnlyHint: 1,
          title: 7
        }
      }
    ])
    const result = await listTools(client as unknown as Parameters<typeof listTools>[0])
    expect(result.tools[0]).not.toHaveProperty('annotations')
  })

  it('projects icons defensively, dropping malformed entries', async () => {
    const client = buildClient([
      {
        name: 't',
        inputSchema: { type: 'object' },
        icons: [
          { src: 'icon.svg', mimeType: 'image/svg+xml', sizes: ['16x16', '32x32'], theme: 'dark' },
          { src: 'bad' },
          { mimeType: 'image/png' },
          null,
          { src: 'plain.png', theme: 'rainbow', sizes: [1, '24x24'] }
        ]
      }
    ])
    const result = await listTools(client as unknown as Parameters<typeof listTools>[0])
    expect(result.tools[0]?.icons).toEqual([
      { src: 'icon.svg', mimeType: 'image/svg+xml', sizes: ['16x16', '32x32'], theme: 'dark' },
      { src: 'bad' },
      { src: 'plain.png', sizes: ['24x24'] }
    ])
  })

  it('omits icons when no valid entry remains', async () => {
    const client = buildClient([
      {
        name: 't',
        inputSchema: { type: 'object' },
        icons: [null, { mimeType: 'x' }]
      }
    ])
    const result = await listTools(client as unknown as Parameters<typeof listTools>[0])
    expect(result.tools[0]).not.toHaveProperty('icons')
  })
})
