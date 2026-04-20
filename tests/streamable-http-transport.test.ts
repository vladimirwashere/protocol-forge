import { describe, expect, it } from 'vitest'

import { AppError } from '../src/shared/errors'
import { normalizeAndValidateStreamableHttpInput } from '../src/main/mcp/transports/streamable-http-transport'

describe('streamable http transport input normalization', () => {
  it('accepts http/https URLs and trims header values', () => {
    const normalized = normalizeAndValidateStreamableHttpInput({
      url: ' https://example.com/mcp ',
      headers: {
        Authorization: '  Bearer token  '
      }
    })

    expect(normalized.url).toBe('https://example.com/mcp')
    expect(normalized.headers).toEqual({ Authorization: 'Bearer token' })
  })

  it('rejects invalid URLs', () => {
    expect(() =>
      normalizeAndValidateStreamableHttpInput({
        url: 'not-a-url'
      })
    ).toThrowError(AppError)
  })

  it('rejects non-http(s) protocols', () => {
    expect(() =>
      normalizeAndValidateStreamableHttpInput({
        url: 'ws://example.com/mcp'
      })
    ).toThrowError(AppError)
  })
})
