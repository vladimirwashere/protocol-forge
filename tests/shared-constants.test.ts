import { describe, expect, it } from 'vitest'

import { APP_NAME } from '../src/shared/constants'

describe('shared constants', () => {
  it('exposes product name', () => {
    expect(APP_NAME).toBe('Protocol Forge')
  })
})
