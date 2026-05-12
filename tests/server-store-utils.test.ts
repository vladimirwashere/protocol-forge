import { describe, expect, it } from 'vitest'

import {
  parseHttpHeadersRaw,
  parseRootsRaw,
  parseStdioArgsRaw,
  stringifyRoots
} from '../src/renderer/src/stores/server-store-utils'

describe('parseHttpHeadersRaw', () => {
  it('parses newline-delimited header entries', () => {
    expect(parseHttpHeadersRaw('Authorization: Bearer token\nX-Trace-Id: 123')).toEqual({
      Authorization: 'Bearer token',
      'X-Trace-Id': '123'
    })
  })

  it('returns empty object for blank input', () => {
    expect(parseHttpHeadersRaw('   \n\n')).toEqual({})
  })

  it('throws on invalid header lines', () => {
    expect(() => parseHttpHeadersRaw('Authorization Bearer token')).toThrow(
      'Invalid header on line 1. Use "Header-Name: value".'
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

describe('parseRootsRaw', () => {
  it('parses one file:// URI per line', () => {
    expect(parseRootsRaw('file:///a\nfile:///b')).toEqual([
      { uri: 'file:///a' },
      { uri: 'file:///b' }
    ])
  })

  it('parses optional name|uri syntax', () => {
    expect(parseRootsRaw('workspace|file:///workspace\nfile:///tmp')).toEqual([
      { uri: 'file:///workspace', name: 'workspace' },
      { uri: 'file:///tmp' }
    ])
  })

  it('skips blank lines', () => {
    expect(parseRootsRaw('\nfile:///a\n\n')).toEqual([{ uri: 'file:///a' }])
  })

  it('rejects non-file:// schemes', () => {
    expect(() => parseRootsRaw('https://example.com')).toThrow(/file:\/\//)
    expect(() => parseRootsRaw('file:///ok\nhttp://x')).toThrow(/line 2/)
  })

  it('rejects malformed file URIs', () => {
    expect(() => parseRootsRaw('file:not-a-url')).toThrow(/file:\/\//)
  })
})

describe('stringifyRoots', () => {
  it('round-trips with parseRootsRaw', () => {
    const roots = [{ uri: 'file:///workspace', name: 'workspace' }, { uri: 'file:///tmp' }]
    expect(parseRootsRaw(stringifyRoots(roots))).toEqual(roots)
  })
})
