import { describe, expect, it } from 'vitest'

import {
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

  it('keeps labeled input unchanged instead of stripping prefixes', () => {
    expect(parseStdioArgsRaw('args: @modelcontextprotocol/server-everything')).toEqual([
      'args:',
      '@modelcontextprotocol/server-everything'
    ])
  })
})
