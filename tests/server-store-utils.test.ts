import { describe, expect, it } from 'vitest'

import {
  normalizeCommandInput,
  normalizeLegacyArgs,
  normalizeSseUrlInput,
  parseSseHeadersRaw,
  parseStdioArgsRaw
} from '../src/renderer/src/stores/server-store-utils'

describe('parseSseHeadersRaw', () => {
  it('parses newline-delimited header entries', () => {
    expect(parseSseHeadersRaw('Authorization: Bearer token\nX-Trace-Id: 123')).toEqual({
      Authorization: 'Bearer token',
      'X-Trace-Id': '123'
    })
  })

  it('returns empty object for blank input', () => {
    expect(parseSseHeadersRaw('   \n\n')).toEqual({})
  })

  it('throws on invalid header lines', () => {
    expect(() => parseSseHeadersRaw('Authorization Bearer token')).toThrow(
      'Invalid SSE header on line 1. Use "Header-Name: value".'
    )
  })
})

describe('parseStdioArgsRaw', () => {
  it('splits args on whitespace', () => {
    expect(parseStdioArgsRaw('foo   bar\tbaz')).toEqual(['foo', 'bar', 'baz'])
  })

  it('strips optional args label prefix', () => {
    expect(parseStdioArgsRaw('args: @modelcontextprotocol/server-everything')).toEqual([
      '@modelcontextprotocol/server-everything'
    ])
  })
})

describe('normalizeCommandInput', () => {
  it('strips optional command label prefix', () => {
    expect(normalizeCommandInput('command: npx')).toBe('npx')
  })
})

describe('normalizeSseUrlInput', () => {
  it('strips optional url label prefix', () => {
    expect(normalizeSseUrlInput('url: https://example.com/mcp/sse')).toBe(
      'https://example.com/mcp/sse'
    )
  })
})

describe('normalizeLegacyArgs', () => {
  it('drops accidental leading args label token from stored args', () => {
    expect(normalizeLegacyArgs(['args:', '@modelcontextprotocol/server-everything'])).toEqual([
      '@modelcontextprotocol/server-everything'
    ])
  })

  it('keeps normal args unchanged', () => {
    expect(normalizeLegacyArgs(['--foo', 'bar'])).toEqual(['--foo', 'bar'])
  })
})
