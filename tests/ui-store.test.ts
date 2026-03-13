import { describe, expect, it } from 'vitest'

import { clampInspectorHeight } from '../src/renderer/src/stores/ui-store-utils'

describe('clampInspectorHeight', () => {
  it('clamps below minimum and above maximum', () => {
    expect(clampInspectorHeight(10)).toBe(160)
    expect(clampInspectorHeight(999)).toBe(520)
  })

  it('rounds fractional values before clamping', () => {
    expect(clampInspectorHeight(220.4)).toBe(220)
    expect(clampInspectorHeight(220.5)).toBe(221)
  })
})
