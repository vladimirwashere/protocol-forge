import { describe, expect, it } from 'vitest'

import { AppError } from '../src/shared/errors'
import { normalizeAndValidateStdioInput } from '../src/main/mcp/transports/stdio-transport'

describe('stdio transport input normalization', () => {
  it('accepts a command name and trims args', () => {
    const normalized = normalizeAndValidateStdioInput({
      command: 'npx',
      args: ['  -y  ', '  @modelcontextprotocol/server-memory  '],
      env: { MCP_LOG_LEVEL: 'debug' }
    })

    expect(normalized.command).toBe('npx')
    expect(normalized.args).toEqual(['-y', '@modelcontextprotocol/server-memory'])
    expect(normalized.env).toEqual({ MCP_LOG_LEVEL: 'debug' })
    expect(normalized.cwd).toBeUndefined()
  })

  it('requires absolute paths when a command path is provided', () => {
    expect(() =>
      normalizeAndValidateStdioInput({
        command: './scripts/server.js',
        args: []
      })
    ).toThrowError(AppError)

    expect(() =>
      normalizeAndValidateStdioInput({
        command: '/usr/bin/env',
        args: ['node', 'server.js']
      })
    ).not.toThrow()
  })

  it('rejects invalid control characters in command', () => {
    expect(() =>
      normalizeAndValidateStdioInput({
        command: 'node\nserver.js',
        args: []
      })
    ).toThrowError(AppError)
  })

  it('rejects invalid environment variable names', () => {
    expect(() =>
      normalizeAndValidateStdioInput({
        command: 'node',
        args: ['server.js'],
        env: {
          'INVALID-NAME': 'value'
        }
      })
    ).toThrowError(AppError)
  })
})
